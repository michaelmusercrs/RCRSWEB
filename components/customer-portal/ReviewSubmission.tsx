'use client';

import { useState, useEffect } from 'react';
import { Star, ExternalLink, CheckCircle, Loader2, MessageSquare } from 'lucide-react';

interface ReviewSubmissionProps {
  customerId: string;
  repName?: string;
  token?: string;
}

interface ExistingReview {
  id: string;
  rating: number;
  content: string;
  platform: string;
  createdAt: string;
  response?: string;
  respondedAt?: string;
}

export default function ReviewSubmission({ customerId, repName, token }: ReviewSubmissionProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [platform, setPlatform] = useState<'google' | 'facebook' | 'direct'>('google');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [existingReviews, setExistingReviews] = useState<ExistingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchExistingReviews();
  }, [token]);

  const fetchExistingReviews = async () => {
    if (!token) { setLoading(false); return; }
    try {
      const response = await fetch(`/api/customer/review?token=${token}`);
      if (response.ok) {
        const data = await response.json();
        setExistingReviews(data.reviews || []);
        if (data.googleReviewUrl) setGoogleReviewUrl(data.googleReviewUrl);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0 || !reviewText.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/customer/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          rating,
          text: reviewText,
          platform,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit review');
      }

      const data = await response.json();
      setSubmitted(true);
      if (data.googleReviewUrl) setGoogleReviewUrl(data.googleReviewUrl);

      // Add to existing reviews list
      setExistingReviews(prev => [{
        id: data.review.id,
        rating: data.review.rating,
        content: data.review.content,
        platform: data.review.platform,
        createdAt: data.review.createdAt,
      }, ...prev]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit review';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (count: number, interactive: boolean = false) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && setRating(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            className={`transition-all duration-150 ${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
          >
            <Star
              size={interactive ? 36 : 18}
              className={`${
                star <= (interactive ? (hoverRating || rating) : count)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-neutral-300'
              } transition-colors`}
            />
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-[#0066CC]" size={32} />
      </div>
    );
  }

  // Thank you state after submission
  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-600" size={32} />
          </div>
          <h3 className="text-xl font-bold text-neutral-800 mb-2">Thank You for Your Review!</h3>
          <p className="text-neutral-600 mb-6">
            We truly appreciate your feedback{repName ? ` about working with ${repName}` : ''}. Your review helps us continue to improve.
          </p>

          {googleReviewUrl && (
            <a
              href={googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#0066CC] text-white rounded-xl font-medium hover:bg-[#005bb5] transition-colors shadow-lg"
            >
              <Star className="fill-white" size={20} />
              Leave a Google Review Too
              <ExternalLink size={16} />
            </a>
          )}

          <p className="text-sm text-neutral-500 mt-4">
            Google reviews help other homeowners find quality roofing services.
          </p>
        </div>

        {/* Show existing reviews below */}
        {existingReviews.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h4 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
              <MessageSquare className="text-[#0066CC]" size={20} />
              Your Reviews
            </h4>
            <div className="space-y-4">
              {existingReviews.map(review => (
                <div key={review.id} className="border border-neutral-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    {renderStars(review.rating)}
                    <span className="text-xs text-neutral-400">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-neutral-700">{review.content}</p>
                  {review.response && (
                    <div className="mt-3 pl-4 border-l-2 border-[#0066CC]">
                      <p className="text-sm text-neutral-500 font-medium mb-1">Response from River City Roofing</p>
                      <p className="text-sm text-neutral-600">{review.response}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Review Form */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-neutral-800 mb-2 flex items-center gap-2">
          <Star className="text-yellow-400 fill-yellow-400" size={20} />
          Share Your Experience
        </h3>
        <p className="text-sm text-neutral-500 mb-6">
          How was your experience with River City Roofing{repName ? ` and ${repName}` : ''}?
        </p>

        {/* Star Rating */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-neutral-700 mb-3">Your Rating</label>
          <div className="flex items-center gap-4">
            {renderStars(rating, true)}
            {rating > 0 && (
              <span className="text-sm text-neutral-500">
                {rating === 5 ? 'Excellent!' : rating === 4 ? 'Great' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
              </span>
            )}
          </div>
        </div>

        {/* Review Text */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-neutral-700 mb-2">Your Review</label>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Tell us about your experience... What did you appreciate most about our service?"
            rows={4}
            className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent resize-none"
          />
        </div>

        {/* Platform Preference */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-neutral-700 mb-2">Where would you like to share?</label>
          <div className="flex flex-wrap gap-3">
            {[
              { id: 'google' as const, label: 'Google', color: 'bg-blue-50 border-blue-200 text-blue-700' },
              { id: 'facebook' as const, label: 'Facebook', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
              { id: 'direct' as const, label: 'Direct to RCRS', color: 'bg-green-50 border-green-200 text-green-700' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPlatform(opt.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  platform === opt.id
                    ? `${opt.color} ring-2 ring-offset-1 ring-[#0066CC]`
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={rating === 0 || !reviewText.trim() || submitting}
          className="w-full bg-[#0066CC] text-white py-3 rounded-xl font-medium hover:bg-[#005bb5] disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Submitting...
            </>
          ) : (
            <>
              <Star size={18} />
              Submit Review
            </>
          )}
        </button>
      </div>

      {/* Existing Reviews */}
      {existingReviews.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h4 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
            <MessageSquare className="text-[#0066CC]" size={20} />
            Your Previous Reviews
          </h4>
          <div className="space-y-4">
            {existingReviews.map(review => (
              <div key={review.id} className="border border-neutral-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  {renderStars(review.rating)}
                  <span className="text-xs text-neutral-400">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-neutral-700">{review.content}</p>
                {review.response && (
                  <div className="mt-3 pl-4 border-l-2 border-[#0066CC]">
                    <p className="text-sm text-neutral-500 font-medium mb-1">Response from River City Roofing</p>
                    <p className="text-sm text-neutral-600">{review.response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
