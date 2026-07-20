'use client';

/**
 * Email Capture Popup — Exit-Intent Only
 *
 * Only shows when the user moves their mouse toward the top of the viewport
 * (indicating they're about to leave/close the tab). On mobile, triggers
 * when the user has been idle for 45 seconds and then scrolls up quickly.
 *
 * Multiple ways to dismiss:
 * - X button (top-right)
 * - "No thanks" link at the bottom
 * - Click/tap the dark backdrop
 * - Press Escape key
 *
 * Stores a localStorage flag to avoid showing again for 7 days after dismiss/submit.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Shield, Phone, Mail, MapPin, CheckCircle } from 'lucide-react';
import HoneypotField from '@/components/forms/HoneypotField';
import TurnstileWidget from '@/components/forms/TurnstileWidget';

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
  const firedRef = useRef(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — bots fill, humans don't
  const [turnstileToken, setTurnstileToken] = useState('');

  const show = useCallback(() => {
    if (!firedRef.current && shouldShow()) {
      firedRef.current = true;
      setVisible(true);
    }
  }, []);

  // Exit-intent detection
  useEffect(() => {
    if (!shouldShow()) return;

    // Desktop: detect mouse leaving toward top of viewport (exit intent)
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 5 && e.relatedTarget === null) {
        show();
      }
    };

    // Mobile: detect rapid scroll-up after idle (proxy for exit intent)
    let lastScrollY = window.scrollY;
    let idleTimer: ReturnType<typeof setTimeout>;
    let isIdle = false;

    const resetIdle = () => {
      isIdle = false;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { isIdle = true; }, 45000);
    };

    const handleScroll = () => {
      const currentY = window.scrollY;
      // Rapid upward scroll of 300px+ while idle = likely leaving
      if (isIdle && lastScrollY - currentY > 300) {
        show();
      }
      lastScrollY = currentY;
    };

    // Start idle timer
    resetIdle();

    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchstart', resetIdle, { passive: true });

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchstart', resetIdle);
      clearTimeout(idleTimer);
    };
  }, [show]);

  // Escape key to dismiss
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible]);

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
          website, // honeypot — server drops if non-empty
          turnstileToken, // Cloudflare Turnstile token (or 'disabled' when inert)
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
          // Google Ads conversion (fires generic lead event; for specific conversion tracking,
          // set NEXT_PUBLIC_GOOGLE_ADS_ID in .env — format: AW-XXXXXXXXX from Google Ads > Conversions)
          if ((window as any).gtag) {
            (window as any).gtag('event', 'generate_lead', {
              event_category: 'email_capture',
              event_label: window.location.pathname,
            });
          }

          // Facebook Pixel lead event (requires NEXT_PUBLIC_FB_PIXEL_ID in .env)
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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-label="Free roof assessment signup"
      onClick={handleDismiss}
    >
      {/* Stop clicks inside the modal from dismissing */}
      <div
        className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button — large and obvious */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-2 text-gray-400 hover:text-white rounded-full hover:bg-zinc-700 bg-zinc-800 transition"
          aria-label="Close popup"
        >
          <X size={22} />
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
                Wait! Before You Go...
              </h3>
              <p className="text-gray-400 text-sm">
                Get a free roof assessment — North Alabama&apos;s #1 rated team will inspect your roof and handle the insurance claim.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="popup-capture-name" className="sr-only">Your Name</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                  <input
                    type="text"
                    id="popup-capture-name"
                    required
                    placeholder="Your Name *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-green transition"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="popup-capture-email" className="sr-only">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                  <input
                    type="email"
                    id="popup-capture-email"
                    required
                    placeholder="Email Address *"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-green transition"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="popup-capture-phone" className="sr-only">Phone Number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                  <input
                    type="tel"
                    id="popup-capture-phone"
                    placeholder="Phone Number (optional)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-green transition"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="popup-capture-address" className="sr-only">Address</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                  <input
                    type="text"
                    id="popup-capture-address"
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

              <HoneypotField value={website} onChange={setWebsite} />

              <TurnstileWidget onVerify={setTurnstileToken} theme="dark" />

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-brand-green hover:bg-brand-green/90 text-black font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
              >
                {submitting ? 'Sending...' : 'Get My Free Roof Assessment →'}
              </button>

              {/* Clear "No thanks" dismiss link */}
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full py-2 text-gray-500 hover:text-gray-300 text-sm underline underline-offset-2 transition"
              >
                No thanks, I&apos;m just browsing
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
