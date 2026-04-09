'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Cookie, Shield } from 'lucide-react';
import { trackingService, ConsentSettings } from '@/lib/tracking-service';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Initialize tracking service
    trackingService.initialize();

    // Check if we should show the banner
    if (trackingService.shouldShowConsentBanner()) {
      // Small delay to prevent flash on page load
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    const settings: ConsentSettings = {
      analytics: 'granted',
      marketing: 'granted',
    };
    trackingService.saveConsentSettings(settings);
    setIsVisible(false);
  };

  const handleDeclineAll = () => {
    const settings: ConsentSettings = {
      analytics: 'denied',
      marketing: 'denied',
    };
    trackingService.saveConsentSettings(settings);
    setIsVisible(false);
  };

  const handleAcceptEssential = () => {
    const settings: ConsentSettings = {
      analytics: 'granted',
      marketing: 'denied',
    };
    trackingService.saveConsentSettings(settings);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          {/* Header */}
          <div className="p-4 md:p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-brand-green/20 rounded-lg flex-shrink-0">
                <Cookie className="w-6 h-6 text-brand-green" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">
                  We Value Your Privacy
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  We use cookies to enhance your browsing experience, analyze site traffic,
                  and personalize content. By clicking "Accept All", you consent to our use
                  of cookies for analytics and marketing purposes.
                </p>
              </div>
              <button
                onClick={handleDeclineAll}
                className="p-1 text-neutral-300 hover:text-white transition-colors flex-shrink-0"
                aria-label="Close cookie banner"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details Section (expandable) */}
            {showDetails && (
              <div className="mt-4 pt-4 border-t border-neutral-700">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-brand-green flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-white font-semibold text-sm">Essential Cookies</h4>
                      <p className="text-neutral-300 text-xs mt-1">
                        Required for basic site functionality. Cannot be disabled.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-white font-semibold text-sm">Analytics Cookies</h4>
                      <p className="text-neutral-300 text-xs mt-1">
                        Help us understand how visitors interact with our website using Google Analytics.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-white font-semibold text-sm">Marketing Cookies</h4>
                      <p className="text-neutral-300 text-xs mt-1">
                        Used to deliver relevant ads and track ad campaign performance via Facebook and Google Ads.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleAcceptAll}
                className="flex-1 px-6 py-3 bg-brand-green text-black font-bold rounded-full hover:bg-lime-400 transition-colors"
              >
                Accept All
              </button>
              <button
                onClick={handleAcceptEssential}
                className="flex-1 px-6 py-3 bg-neutral-800 text-white font-semibold rounded-full hover:bg-neutral-700 transition-colors border border-neutral-600"
              >
                Essential Only
              </button>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="px-6 py-3 text-neutral-300 font-medium hover:text-white transition-colors text-sm"
              >
                {showDetails ? 'Hide Details' : 'Learn More'}
              </button>
            </div>

            {/* Privacy Policy Link */}
            <p className="mt-4 text-center text-xs text-neutral-300">
              View our{' '}
              <Link href="/privacy" className="text-brand-green hover:underline">
                Privacy Policy
              </Link>
              {' '}for more information on how we handle your data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
