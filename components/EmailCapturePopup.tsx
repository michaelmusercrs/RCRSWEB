'use client';

/**
 * Email Capture Popup
 * 
 * Shows after 10 seconds or 50% scroll on the public site.
 * Captures name, email, phone (optional), address (optional).
 * Submits to /api/email-capture.
 * 
 * Stores a localStorage flag to avoid showing again for 7 days after dismiss/submit.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Shield, Phone, Mail, MapPin, CheckCircle } from 'lucide-react';

const DISMISS_KEY = 'rcrs_email_popup_dismissed';
const DISMISS_DAYS = 7;

function getUtmParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get('utm_source') || '',
    utmMedium: params.get('utm_medium') || '',
    utmCampaign: params.get('utm_campaign') || '',
    utmTerm: params.get('utm_term') || '',
    utmContent: params.get('utm_content') || '',
  };
}

function shouldShow(): boolean {
  if (typeof window === 'undefined') return false;
  const dismissed = localStorage.getItem(DISMISS_KEY);
  if (!dismissed) return true;
  const dismissedAt = parseInt(dismissed, 10);
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince > DISMISS_DAYS;
}

function markDismissed() {
  localStorage.setItem(DISMISS_KEY, Date.now().toString());
}

export default function EmailCapturePopup() {
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const show = useCallback(() => {
    if (shouldShow()) setVisible(true);
  }, []);

  useEffect(() => {
    if (!shouldShow()) return;

    // Show after 10 seconds
    const timer = setTimeout(show, 10000);

    // Or show on 50% scroll
    const handleScroll = () => {
      const scrollPercent = window.scrollY / (document.body.scrollHeight - window.innerHeight);
      if (scrollPercent >= 0.5) {
        show();
        window.removeEventListener('scroll', handleScroll);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [show]);

  const handleDismiss = () => {
    setVisible(false);
    markDismissed();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const utmParams = getUtmParams();
      const res = await fetch('/api/email-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          address,
          sourcePage: window.location.pathname,
          ...utmParams,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Something went wrong.');
      } else {
        setSubmitted(true);
        markDismissed();

        // Fire conversion events if available
        if (typeof window !== 'undefined') {
          // Google Ads conversion
          // TODO: Replace YOUR_CONVERSION_ID and YOUR_CONVERSION_LABEL with actual values
          // Michael needs to provide: Google Ads Conversion ID (e.g., AW-XXXXXXXXX)
          // and Conversion Label from Google Ads dashboard
          if ((window as any).gtag) {
            (window as any).gtag('event', 'generate_lead', {
              event_category: 'email_capture',
              event_label: window.location.pathname,
            });
          }

          // Facebook Pixel lead event
          // TODO: FB Pixel ID is set in .env as NEXT_PUBLIC_FB_PIXEL_ID
          // Michael needs to provide: Facebook Pixel ID from Facebook Events Manager
          if ((window as any).fbq) {
            (window as any).fbq('track', 'Lead', {
              content_name: 'email_capture_popup',
            });
          }
        }

        setTimeout(() => setVisible(false), 3000);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 text-gray-500 hover:text-white rounded-full hover:bg-zinc-800 transition"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {submitted ? (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">Thank You!</h3>
            <p className="text-gray-400">We&apos;ll be in touch soon about your free assessment.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-brand-green/20 text-brand-green px-3 py-1 rounded-full text-sm font-medium mb-3">
                <Shield size={14} />
                100% Free — No Obligation
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Storm Damage?<br />Get Your Free Assessment
              </h3>
              <p className="text-gray-400 text-sm">
                North Alabama&apos;s #1 rated roofing team. We&apos;ll inspect your roof and handle the insurance claim.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    required
                    placeholder="Your Name *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-green transition"
                  />
                </div>
              </div>
              <div>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="email"
                    required
                    placeholder="Email Address *"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-green transition"
                  />
                </div>
              </div>
              <div>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="tel"
                    placeholder="Phone Number (optional)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-green transition"
                  />
                </div>
              </div>
              <div>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Address (optional)"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-green transition"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-brand-green hover:bg-brand-green/90 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
              >
                {submitting ? 'Sending...' : 'Get My Free Roof Assessment →'}
              </button>

              <p className="text-gray-600 text-xs text-center">
                We respect your privacy. No spam, ever.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
