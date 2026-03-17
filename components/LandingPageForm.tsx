'use client';

import { useState, useEffect } from 'react';
import { Phone, Send, Loader2 } from 'lucide-react';

interface LandingPageFormProps {
  /** CTA button text, e.g. "Get Free Inspection" */
  ctaText: string;
  /** What service this form is for, used in lead source tracking */
  serviceType: string;
  /** The landing page slug for attribution, e.g. "lp/roof-repair" */
  sourcePage: string;
  /** Whether to show the address field */
  showAddress?: boolean;
  /** Whether to show the description/message field */
  showDescription?: boolean;
  /** Placeholder text for the description field */
  descriptionPlaceholder?: string;
}

export default function LandingPageForm({
  ctaText,
  serviceType,
  sourcePage,
  showAddress = true,
  showDescription = true,
  descriptionPlaceholder = 'Briefly describe your situation (optional)',
}: LandingPageFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // UTM parameter capture
  const [utmParams, setUtmParams] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach((key) => {
        const val = params.get(key);
        if (val) utm[key] = val;
      });
      setUtmParams(utm);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/forms/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          address: address || undefined,
          subject: serviceType,
          message: description || `${serviceType} inquiry from Google Ads landing page.`,
          sourcePage: `Landing Page: ${sourcePage}`,
          leadSource: 'Google Ads',
          leadSourceDetail: `LP: ${sourcePage}`,
          marketingSource: utmParams.utm_source
            ? `${utmParams.utm_source} / ${utmParams.utm_medium || 'cpc'} / ${utmParams.utm_campaign || 'unknown'}`
            : 'Google Ads - Landing Page',
        }),
      });

      const result = await res.json();

      if (result.success) {
        setSuccess(true);

        // Google Ads conversion tracking
        if (typeof window !== 'undefined' && window.gtag) {
          window.gtag('event', 'conversion', {
            send_to: `${process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || 'AW-CONVERSION_ID'}/CONVERSION_LABEL`,
            value: 1.0,
            currency: 'USD',
          });
          // Also fire a custom event for GA4
          window.gtag('event', 'generate_lead', {
            event_category: 'Landing Page',
            event_label: sourcePage,
            value: 1,
          });
        }
      } else {
        setError(result.message || 'Something went wrong. Please call us at (256) 274-8530.');
      }
    } catch {
      setError('Unable to send. Please call us at (256) 274-8530.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-8 px-4">
        <div className="w-16 h-16 bg-brand-green rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-black uppercase tracking-wider text-brand-green mb-2">
          Request Received!
        </h3>
        <p className="text-neutral-300 mb-4">
          We&apos;ll contact you within 1 hour during business hours.
        </p>
        <a
          href="tel:256-274-8530"
          className="inline-flex items-center gap-2 bg-brand-green text-black font-black uppercase tracking-widest px-6 py-3 rounded-lg hover:bg-lime-400 transition-all"
        >
          <Phone className="w-5 h-5" /> Call Now: (256) 274-8530
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Hidden fields for UTM tracking */}
      {Object.entries(utmParams).map(([key, val]) => (
        <input key={key} type="hidden" name={key} value={val} />
      ))}

      <div>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name *"
          className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
        />
      </div>

      <div>
        <input
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone Number *"
          className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
        />
      </div>

      {showAddress && (
        <div>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Property Address"
            className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
          />
        </div>
      )}

      {showDescription && (
        <div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={descriptionPlaceholder}
            rows={2}
            className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all resize-none"
          />
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-brand-green text-black font-black uppercase tracking-widest rounded-lg hover:bg-lime-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-lg shadow-lg shadow-brand-green/20"
      >
        {loading ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Sending...</>
        ) : (
          <><Send className="w-5 h-5" /> {ctaText}</>
        )}
      </button>

      <div className="text-center">
        <a
          href="tel:256-274-8530"
          className="inline-flex items-center gap-2 text-brand-green font-bold text-sm uppercase tracking-widest hover:text-lime-400 transition-all"
        >
          <Phone className="w-4 h-4" /> Or Call: (256) 274-8530
        </a>
      </div>

      <p className="text-center text-xs text-neutral-500">
        100% free. No obligation. We respond within 1 hour.
      </p>
    </form>
  );
}
