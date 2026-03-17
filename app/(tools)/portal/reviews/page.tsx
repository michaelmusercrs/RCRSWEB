'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Star,
  MessageSquare,
  Send,
  Eye,
  Share2,
  ExternalLink,
  Filter,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  Award,
  Heart,
  ThumbsUp,
  Bookmark,
  ArrowLeft,
  X,
  Loader2,
  User,
  MapPin,
  Clock,
  Calendar,
  BarChart2,
  Flag,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

type ReviewPlatform = 'google' | 'facebook' | 'yelp' | 'bbb' | 'internal' | 'homeadvisor';
type RequestMethod = 'sms' | 'email' | 'both';
type RequestStatus = 'pending' | 'sent' | 'opened' | 'completed' | 'declined';

interface CustomerReview {
  id: string;
  customerId: string;
  customerName: string;
  address: string;
  jobId?: string;
  platform: ReviewPlatform;
  rating: number;
  title?: string;
  content: string;
  response?: string;
  respondedBy?: string;
  respondedAt?: string;
  repSlug?: string;
  repName?: string;
  isPublished: boolean;
  isFeatured: boolean;
  sentRequestAt?: string;
  requestMethod?: RequestMethod;
  photos?: string[];
  createdAt: string;
  updatedAt: string;
}

interface ReviewRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  jobId: string;
  repSlug: string;
  method: RequestMethod;
  sentAt: string;
  status: RequestStatus;
  reminderCount: number;
  lastReminderAt?: string;
  reviewId?: string;
  createdAt: string;
}

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  byPlatform: Record<string, { count: number; avgRating: number }>;
  byRep: Record<string, { count: number; avgRating: number }>;
  thisMonth: number;
  pendingRequests: number;
  responseRate: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PLATFORM_LABELS: Record<ReviewPlatform, string> = {
  google: 'Google',
  facebook: 'Facebook',
  yelp: 'Yelp',
  bbb: 'BBB',
  internal: 'Direct',
  homeadvisor: 'HomeAdvisor',
};

const PLATFORM_COLORS: Record<ReviewPlatform, string> = {
  google: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  facebook: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
  yelp: 'bg-red-500/20 text-red-400 border-red-500/30',
  bbb: 'bg-sky-600/20 text-sky-400 border-sky-600/30',
  internal: 'bg-[#39FF14]/20 text-[#39FF14] border-[#39FF14]/30',
  homeadvisor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const STATUS_COLORS: Record<RequestStatus, string> = {
  pending: 'bg-gray-500/20 text-gray-400',
  sent: 'bg-blue-500/20 text-blue-400',
  opened: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-green-500/20 text-green-400',
  declined: 'bg-red-500/20 text-red-400',
};

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderStars(rating: number, size: 'sm' | 'md' | 'lg' = 'md'): React.ReactNode {
  const sizeClass = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`${sizeClass} ${i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
        />
      ))}
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

type ActiveTab = 'reviews' | 'requests' | 'featured' | 'leaderboard';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('reviews');
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [respondedBy, setRespondedBy] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal states
  const [showAddReview, setShowAddReview] = useState(false);
  const [showRequestReview, setShowRequestReview] = useState(false);

  // New review form
  const [reviewForm, setReviewForm] = useState({
    customerName: '',
    address: '',
    platform: 'google' as ReviewPlatform,
    rating: 5,
    title: '',
    content: '',
    repSlug: '',
    repName: '',
    jobId: '',
  });

  // Review request form
  const [requestForm, setRequestForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    jobId: '',
    repSlug: '',
    method: 'email' as RequestMethod,
  });

  // -------------------------------------------------------------------------
  // DATA LOADING
  // -------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (platformFilter !== 'all') params.set('platform', platformFilter);
      if (ratingFilter !== 'all') params.set('rating', ratingFilter);

      const [reviewsRes, requestsRes, statsRes] = await Promise.all([
        fetch(`/api/reviews?${params.toString()}`),
        fetch('/api/reviews/request'),
        fetch('/api/reviews/stats'),
      ]);

      const [reviewsData, requestsData, statsData] = await Promise.all([
        reviewsRes.json(),
        requestsRes.json(),
        statsRes.json(),
      ]);

      if (reviewsData.success) setReviews(reviewsData.reviews || []);
      if (requestsData.success) setRequests(requestsData.requests || []);
      if (statsData.success) setStats(statsData.stats || null);
    } catch (error) {
      console.error('Failed to fetch reviews data:', error);
    } finally {
      setLoading(false);
    }
  }, [platformFilter, ratingFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -------------------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------------------

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: reviewForm.customerName,
          address: reviewForm.address,
          platform: reviewForm.platform,
          rating: reviewForm.rating,
          title: reviewForm.title || undefined,
          content: reviewForm.content,
          repSlug: reviewForm.repSlug || undefined,
          repName: reviewForm.repName || undefined,
          jobId: reviewForm.jobId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddReview(false);
        setReviewForm({
          customerName: '', address: '', platform: 'google', rating: 5,
          title: '', content: '', repSlug: '', repName: '', jobId: '',
        });
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to add review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespond = async (reviewId: string) => {
    if (!responseText.trim() || !respondedBy.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond',
          response: responseText,
          respondedBy,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRespondingTo(null);
        setResponseText('');
        setRespondedBy('');
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to respond:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleFeatured = async (reviewId: string, featured: boolean) => {
    try {
      await fetch(`/api/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'feature', featured }),
      });
      await fetchData();
    } catch (error) {
      console.error('Failed to toggle featured:', error);
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowRequestReview(false);
        setRequestForm({
          customerName: '', customerPhone: '', customerEmail: '',
          jobId: '', repSlug: '', method: 'email',
        });
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to send request:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReminder = async (requestId: string) => {
    try {
      await fetch('/api/reviews/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remind', requestId }),
      });
      await fetchData();
    } catch (error) {
      console.error('Failed to send reminder:', error);
    }
  };

  // -------------------------------------------------------------------------
  // FILTER
  // -------------------------------------------------------------------------

  const filteredReviews = reviews.filter(r => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.customerName.toLowerCase().includes(term) ||
      r.content.toLowerCase().includes(term) ||
      (r.title || '').toLowerCase().includes(term) ||
      (r.repName || '').toLowerCase().includes(term)
    );
  });

  const featuredReviews = filteredReviews.filter(r => r.isFeatured);

  // Build rep leaderboard
  const repLeaderboard = stats?.byRep
    ? Object.entries(stats.byRep)
        .map(([slug, data]) => ({ slug, ...data }))
        .sort((a, b) => b.avgRating - a.avgRating || b.count - a.count)
    : [];

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#39FF14] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/portal" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold">Review Management</h1>
          </div>
          <p className="text-gray-400 text-sm ml-8">Manage reviews across platforms, request and respond</p>
        </div>
        <div className="flex gap-2 self-start">
          <button
            onClick={() => setShowRequestReview(true)}
            className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Request Review
          </button>
          <button
            onClick={() => setShowAddReview(true)}
            className="px-4 py-2.5 bg-[#39FF14] text-black rounded-lg hover:bg-[#32e612] transition font-semibold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Review
          </button>
        </div>
      </div>

      {/* Stats Dashboard */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-3xl font-bold text-yellow-400">{stats.averageRating}</div>
              <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
            </div>
            <div className="text-sm text-gray-400">Avg Rating</div>
            {renderStars(Math.round(stats.averageRating), 'sm')}
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-2xl font-bold text-[#39FF14]">{stats.totalReviews}</div>
            <div className="text-sm text-gray-400">Total Reviews</div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-2xl font-bold text-blue-400">{stats.thisMonth}</div>
            <div className="text-sm text-gray-400">This Month</div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-2xl font-bold text-purple-400">{stats.responseRate}%</div>
            <div className="text-sm text-gray-400">Response Rate</div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-2xl font-bold text-orange-400">{stats.pendingRequests}</div>
            <div className="text-sm text-gray-400">Pending Requests</div>
          </div>
        </div>
      )}

      {/* Rating Distribution */}
      {stats && (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Rating Distribution</h3>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(rating => {
              const count = stats.ratingDistribution[rating] || 0;
              const maxCount = Math.max(...Object.values(stats.ratingDistribution), 1);
              const width = maxCount > 0 ? (count / maxCount) * 100 : 0;

              return (
                <div key={rating} className="flex items-center gap-3">
                  <span className="text-sm w-12 flex items-center gap-1">
                    {rating} <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  </span>
                  <div className="flex-1 bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full bg-yellow-400/70 rounded-full transition-all duration-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-400 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>

          {/* Platform breakdown */}
          {Object.keys(stats.byPlatform).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h4 className="text-xs font-semibold text-gray-500 mb-2">By Platform</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.byPlatform).map(([platform, data]) => (
                  <div
                    key={platform}
                    className={`px-3 py-1.5 rounded-lg border text-xs ${PLATFORM_COLORS[platform as ReviewPlatform] || 'bg-gray-700 text-gray-400 border-gray-600'}`}
                  >
                    {PLATFORM_LABELS[platform as ReviewPlatform] || platform}: {data.count} ({data.avgRating})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1 overflow-x-auto">
        {[
          { key: 'reviews' as ActiveTab, label: 'All Reviews', icon: <Star className="w-4 h-4" /> },
          { key: 'requests' as ActiveTab, label: 'Requests', icon: <Send className="w-4 h-4" /> },
          { key: 'featured' as ActiveTab, label: 'Featured', icon: <Award className="w-4 h-4" /> },
          { key: 'leaderboard' as ActiveTab, label: 'Leaderboard', icon: <BarChart2 className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-[#39FF14] text-black'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters (for reviews tab) */}
      {(activeTab === 'reviews' || activeTab === 'featured') && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search reviews..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500"
            />
          </div>

          <select
            value={platformFilter}
            onChange={e => setPlatformFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white"
          >
            <option value="all">All Platforms</option>
            {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={ratingFilter}
            onChange={e => setRatingFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white"
          >
            <option value="all">All Ratings</option>
            {[5, 4, 3, 2, 1].map(r => (
              <option key={r} value={r}>{r} Star{r !== 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>
      )}

      {/* ============================================================= */}
      {/* REVIEWS TAB */}
      {/* ============================================================= */}

      {activeTab === 'reviews' && (
        <div className="space-y-3">
          {filteredReviews.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg">No reviews yet</p>
              <p className="text-sm mt-1">Add a review or send a request to get started</p>
            </div>
          ) : (
            filteredReviews.map(review => (
              <div
                key={review.id}
                className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
              >
                {/* Review Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-750 transition"
                  onClick={() => setExpandedReview(expandedReview === review.id ? null : review.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {renderStars(review.rating)}
                        <span className={`px-2 py-0.5 rounded text-xs border ${PLATFORM_COLORS[review.platform]}`}>
                          {PLATFORM_LABELS[review.platform]}
                        </span>
                        {review.isFeatured && (
                          <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            Featured
                          </span>
                        )}
                        {review.response && (
                          <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                            Responded
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{review.customerName}</span>
                        <span className="text-xs text-gray-500">{formatDate(review.createdAt)}</span>
                      </div>
                      {review.title && (
                        <p className="text-sm font-medium text-gray-300 mt-1">{review.title}</p>
                      )}
                      <p className="text-sm text-gray-400 mt-1 line-clamp-2">{review.content}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFeatured(review.id, !review.isFeatured);
                        }}
                        className={`p-1.5 rounded-lg transition ${
                          review.isFeatured
                            ? 'text-yellow-400 bg-yellow-500/20 hover:bg-yellow-500/30'
                            : 'text-gray-500 hover:text-yellow-400 hover:bg-gray-700'
                        }`}
                        title={review.isFeatured ? 'Unfeature' : 'Feature'}
                      >
                        <Bookmark className={`w-4 h-4 ${review.isFeatured ? 'fill-yellow-400' : ''}`} />
                      </button>
                      <ChevronDown
                        className={`w-4 h-4 text-gray-500 transition-transform ${
                          expandedReview === review.id ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Review */}
                {expandedReview === review.id && (
                  <div className="border-t border-gray-700 p-4 space-y-4">
                    {/* Full content */}
                    <div>
                      <p className="text-gray-300">{review.content}</p>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {review.address}
                      </span>
                      {review.repName && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          Rep: {review.repName}
                        </span>
                      )}
                      {review.jobId && (
                        <span className="flex items-center gap-1">
                          <Flag className="w-3 h-3" />
                          Job: {review.jobId}
                        </span>
                      )}
                    </div>

                    {/* Existing response */}
                    {review.response && (
                      <div className="bg-gray-700/50 rounded-lg p-3 border-l-2 border-[#39FF14]">
                        <div className="text-xs text-gray-400 mb-1">
                          Response by {review.respondedBy} - {review.respondedAt ? formatDate(review.respondedAt) : ''}
                        </div>
                        <p className="text-sm text-gray-300">{review.response}</p>
                      </div>
                    )}

                    {/* Respond form */}
                    {!review.response && respondingTo !== review.id && (
                      <button
                        onClick={() => setRespondingTo(review.id)}
                        className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition text-sm flex items-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Write Response
                      </button>
                    )}

                    {respondingTo === review.id && (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={respondedBy}
                          onChange={e => setRespondedBy(e.target.value)}
                          placeholder="Your name"
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white text-sm"
                        />
                        <textarea
                          value={responseText}
                          onChange={e => setResponseText(e.target.value)}
                          placeholder="Write your response..."
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white text-sm min-h-[80px]"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setRespondingTo(null); setResponseText(''); setRespondedBy(''); }}
                            className="px-3 py-1.5 bg-gray-700 rounded-lg hover:bg-gray-600 transition text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleRespond(review.id)}
                            disabled={submitting || !responseText.trim() || !respondedBy.trim()}
                            className="px-4 py-1.5 bg-[#39FF14] text-black rounded-lg hover:bg-[#32e612] transition text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                          >
                            {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            Submit Response
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* REQUESTS TAB */}
      {/* ============================================================= */}

      {activeTab === 'requests' && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Send className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg">No review requests sent yet</p>
              <button
                onClick={() => setShowRequestReview(true)}
                className="mt-3 px-4 py-2 bg-[#39FF14] text-black rounded-lg hover:bg-[#32e612] transition font-semibold text-sm"
              >
                Send First Request
              </button>
            </div>
          ) : (
            requests.map(req => (
              <div
                key={req.id}
                className="bg-gray-800 rounded-xl p-4 border border-gray-700"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{req.customerName}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[req.status]}`}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                      <span>Method: {req.method.toUpperCase()}</span>
                      <span>Sent: {formatDate(req.sentAt)}</span>
                      <span>Job: {req.jobId}</span>
                      <span>Rep: {req.repSlug}</span>
                      {req.reminderCount > 0 && (
                        <span className="text-yellow-400">Reminders: {req.reminderCount}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {(req.status === 'sent' || req.status === 'opened') && (
                      <button
                        onClick={() => handleSendReminder(req.id)}
                        className="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition text-xs flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        Remind
                      </button>
                    )}
                    {req.reviewId && (
                      <span className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3" />
                        Review Received
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* FEATURED TAB */}
      {/* ============================================================= */}

      {activeTab === 'featured' && (
        <div className="space-y-3">
          {featuredReviews.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg">No featured reviews</p>
              <p className="text-sm mt-1">Click the bookmark icon on any review to feature it</p>
            </div>
          ) : (
            featuredReviews.map(review => (
              <div
                key={review.id}
                className="bg-gray-800 rounded-xl p-5 border border-yellow-500/20"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                      <Award className="w-6 h-6 text-yellow-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {renderStars(review.rating)}
                      <span className={`px-2 py-0.5 rounded text-xs border ${PLATFORM_COLORS[review.platform]}`}>
                        {PLATFORM_LABELS[review.platform]}
                      </span>
                    </div>
                    {review.title && (
                      <h3 className="font-semibold mb-1">{review.title}</h3>
                    )}
                    <p className="text-gray-300 mb-2">{review.content}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="font-medium text-gray-300">{review.customerName}</span>
                      <span>{formatDate(review.createdAt)}</span>
                      {review.repName && <span>Rep: {review.repName}</span>}
                    </div>
                    {review.response && (
                      <div className="mt-3 bg-gray-700/50 rounded-lg p-3 border-l-2 border-[#39FF14]">
                        <p className="text-sm text-gray-300">{review.response}</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleFeatured(review.id, false)}
                    className="text-yellow-400 hover:text-yellow-300 transition p-1"
                    title="Remove from featured"
                  >
                    <Bookmark className="w-5 h-5 fill-yellow-400" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* LEADERBOARD TAB */}
      {/* ============================================================= */}

      {activeTab === 'leaderboard' && (
        <div className="space-y-3">
          {repLeaderboard.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg">No rep data yet</p>
              <p className="text-sm mt-1">Reviews with assigned reps will appear here</p>
            </div>
          ) : (
            repLeaderboard.map((rep, idx) => {
              const featuredCount = reviews.filter(r => r.repSlug === rep.slug && r.isFeatured).length;

              return (
                <div
                  key={rep.slug}
                  className={`bg-gray-800 rounded-xl p-4 border ${
                    idx === 0 ? 'border-yellow-500/40' : idx === 1 ? 'border-gray-500/40' : idx === 2 ? 'border-orange-600/40' : 'border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                      idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      idx === 1 ? 'bg-gray-500/20 text-gray-300' :
                      idx === 2 ? 'bg-orange-600/20 text-orange-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {idx + 1}
                    </div>

                    <div className="flex-1">
                      <div className="font-semibold">{rep.slug}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {renderStars(Math.round(rep.avgRating), 'sm')}
                        <span className="text-sm text-yellow-400 ml-1">{rep.avgRating}</span>
                      </div>
                    </div>

                    <div className="flex gap-6 text-center">
                      <div>
                        <div className="text-lg font-bold text-[#39FF14]">{rep.count}</div>
                        <div className="text-xs text-gray-500">Reviews</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-yellow-400">{rep.avgRating}</div>
                        <div className="text-xs text-gray-500">Avg Rating</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-purple-400">{featuredCount}</div>
                        <div className="text-xs text-gray-500">Featured</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* ADD REVIEW MODAL */}
      {/* ============================================================= */}

      {showAddReview && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Add Review</h2>
              <button onClick={() => setShowAddReview(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddReview} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={reviewForm.customerName}
                    onChange={e => setReviewForm(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Address</label>
                  <input
                    type="text"
                    value={reviewForm.address}
                    onChange={e => setReviewForm(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Platform</label>
                  <select
                    value={reviewForm.platform}
                    onChange={e => setReviewForm(prev => ({ ...prev, platform: e.target.value as ReviewPlatform }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                  >
                    {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Rating</label>
                  <div className="flex items-center gap-1 py-2">
                    {[1, 2, 3, 4, 5].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReviewForm(prev => ({ ...prev, rating: r }))}
                        className="p-0.5"
                      >
                        <Star
                          className={`w-6 h-6 transition ${
                            r <= reviewForm.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600 hover:text-yellow-400/50'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={reviewForm.title}
                  onChange={e => setReviewForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                  placeholder="Great experience!"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Review Content</label>
                <textarea
                  value={reviewForm.content}
                  onChange={e => setReviewForm(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white min-h-[100px]"
                  placeholder="What did the customer say?"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Rep Slug</label>
                  <input
                    type="text"
                    value={reviewForm.repSlug}
                    onChange={e => setReviewForm(prev => ({ ...prev, repSlug: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    placeholder="john-doe"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Rep Name</label>
                  <input
                    type="text"
                    value={reviewForm.repName}
                    onChange={e => setReviewForm(prev => ({ ...prev, repName: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Job ID</label>
                  <input
                    type="text"
                    value={reviewForm.jobId}
                    onChange={e => setReviewForm(prev => ({ ...prev, jobId: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    placeholder="JOB-001"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddReview(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-[#39FF14] text-black rounded-lg hover:bg-[#32e612] transition font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {submitting ? 'Saving...' : 'Add Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* REQUEST REVIEW MODAL */}
      {/* ============================================================= */}

      {showRequestReview && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Request Review</h2>
              <button onClick={() => setShowRequestReview(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendRequest} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={requestForm.customerName}
                  onChange={e => setRequestForm(prev => ({ ...prev, customerName: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Phone</label>
                  <input
                    type="text"
                    value={requestForm.customerPhone}
                    onChange={e => setRequestForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    placeholder="(256) 555-1234"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={requestForm.customerEmail}
                    onChange={e => setRequestForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    placeholder="customer@email.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Job ID</label>
                  <input
                    type="text"
                    value={requestForm.jobId}
                    onChange={e => setRequestForm(prev => ({ ...prev, jobId: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Rep Slug</label>
                  <input
                    type="text"
                    value={requestForm.repSlug}
                    onChange={e => setRequestForm(prev => ({ ...prev, repSlug: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Send Method</label>
                <div className="flex gap-2">
                  {(['email', 'sms', 'both'] as RequestMethod[]).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRequestForm(prev => ({ ...prev, method: m }))}
                      className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition ${
                        requestForm.method === m
                          ? 'bg-[#39FF14]/20 text-[#39FF14] border-[#39FF14]/30'
                          : 'bg-gray-700 text-gray-400 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      {m === 'both' ? 'Both' : m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Preview */}
              <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                <div className="text-xs text-gray-400 mb-2">Message Preview</div>
                <p className="text-sm text-gray-300">
                  Hi {requestForm.customerName || '[Customer]'}, thank you for choosing River City Roofing Solutions!
                  We hope you are happy with your new roof. Would you take a moment to share your experience?
                  Your feedback helps us continue to provide excellent service. Thank you!
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestReview(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-[#39FF14] text-black rounded-lg hover:bg-[#32e612] transition font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {submitting ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
