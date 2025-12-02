'use client';

import { useState } from 'react';
import { Loader2, Gift, CheckCircle2 } from 'lucide-react';
import { teamMembers } from '@/lib/teamData';

const salesTeam = teamMembers.filter(m =>
  m.category === 'Leadership' || m.category === 'Regional Partner' || m.category === 'Production'
);

export default function ReferralForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch('/api/forms/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrerName: formData.get('referrerName'),
          referrerPhone: formData.get('referrerPhone'),
          referrerEmail: formData.get('referrerEmail') || '',
          referralName: formData.get('referralName'),
          referralPhone: formData.get('referralPhone'),
          referralEmail: formData.get('referralEmail') || '',
          referralAddress: formData.get('referralAddress'),
          salesRep: formData.get('salesRep') || '',
          notes: formData.get('notes') || '',
          sourcePage: 'Referral Rewards Page',
        }),
      });

      const result = await response.json();

      if (result.success) {
        setIsSubmitted(true);
        form.reset();
      } else {
        setError(result.message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please try again or call us at (256) 274-8530.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-brand-green rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-black" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Referral Submitted!</h3>
        <p className="text-neutral-300 mb-4">
          Thank you for your referral! We'll reach out to them soon and keep you updated on your reward.
        </p>
        <button
          onClick={() => setIsSubmitted(false)}
          className="bg-brand-green hover:bg-lime-400 text-black font-bold py-3 px-6 rounded-full transition-colors"
        >
          Submit Another Referral
        </button>
      </div>
    );
  }

  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-6 md:p-8">
      <div className="flex items-center justify-center gap-3 mb-6">
        <Gift className="text-brand-green" size={28} />
        <h3 className="text-2xl font-bold text-white">Submit a Referral</h3>
      </div>

      <p className="text-neutral-400 text-center mb-6">
        Fill out the form below to submit your referral and earn $100 when they get a new roof!
      </p>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Your Information */}
        <div>
          <h4 className="text-lg font-semibold text-brand-green mb-4">Your Information</h4>
          <div className="space-y-4">
            <div>
              <label htmlFor="referrerName" className="block text-sm font-medium text-gray-200 mb-1">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="referrerName"
                name="referrerName"
                required
                placeholder="John Doe"
                className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-white/10 text-white placeholder-gray-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none transition-colors"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="referrerPhone" className="block text-sm font-medium text-gray-200 mb-1">
                  Your Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="referrerPhone"
                  name="referrerPhone"
                  required
                  placeholder="(256) 555-1234"
                  className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-white/10 text-white placeholder-gray-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none transition-colors"
                />
              </div>
              <div>
                <label htmlFor="referrerEmail" className="block text-sm font-medium text-gray-200 mb-1">
                  Your Email
                </label>
                <input
                  type="email"
                  id="referrerEmail"
                  name="referrerEmail"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-white/10 text-white placeholder-gray-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Referral Information */}
        <div className="border-t border-neutral-700 pt-6">
          <h4 className="text-lg font-semibold text-brand-green mb-4">Person You're Referring</h4>
          <div className="space-y-4">
            <div>
              <label htmlFor="referralName" className="block text-sm font-medium text-gray-200 mb-1">
                Their Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="referralName"
                name="referralName"
                required
                placeholder="Jane Smith"
                className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-white/10 text-white placeholder-gray-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none transition-colors"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="referralPhone" className="block text-sm font-medium text-gray-200 mb-1">
                  Their Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="referralPhone"
                  name="referralPhone"
                  required
                  placeholder="(256) 555-5678"
                  className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-white/10 text-white placeholder-gray-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none transition-colors"
                />
              </div>
              <div>
                <label htmlFor="referralEmail" className="block text-sm font-medium text-gray-200 mb-1">
                  Their Email
                </label>
                <input
                  type="email"
                  id="referralEmail"
                  name="referralEmail"
                  placeholder="them@example.com"
                  className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-white/10 text-white placeholder-gray-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none transition-colors"
                />
              </div>
            </div>
            <div>
              <label htmlFor="referralAddress" className="block text-sm font-medium text-gray-200 mb-1">
                Their Property Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="referralAddress"
                name="referralAddress"
                required
                placeholder="123 Main St, Huntsville, AL 35801"
                className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-white/10 text-white placeholder-gray-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="border-t border-neutral-700 pt-6">
          <h4 className="text-lg font-semibold text-brand-green mb-4">Additional Information</h4>
          <div className="space-y-4">
            <div>
              <label htmlFor="salesRep" className="block text-sm font-medium text-gray-200 mb-1">
                Who helped you? (optional)
              </label>
              <select
                id="salesRep"
                name="salesRep"
                className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-gray-800 text-white focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none transition-colors"
              >
                <option value="">Don't remember / Not sure</option>
                {salesTeam.map((member) => (
                  <option key={member.slug} value={member.name}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-200 mb-1">
                Additional Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Any additional information..."
                className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-white/10 text-white placeholder-gray-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-brand-green hover:bg-lime-400 text-black font-bold py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
          {isSubmitting ? 'Submitting...' : 'Submit Referral'}
        </button>

        <p className="text-xs text-center text-neutral-400">
          By submitting, you confirm you have permission to share this person's contact information.
        </p>
      </form>
    </div>
  );
}
