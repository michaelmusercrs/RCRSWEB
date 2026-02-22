'use client';

import { useEffect } from 'react';
import { Phone, Shield, Star, Clock, CheckCircle2, Award } from 'lucide-react';
import ContactForm from '@/components/ContactForm';
import { trackingService } from '@/lib/tracking-service';
import type { LandingPageConfig } from '@/lib/landing-pages';

interface Props {
  config: LandingPageConfig;
}

export default function LandingPageClient({ config }: Props) {
  // Store campaign UTM data on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Force-set UTM params from campaign config (supplements URL params)
    const params = new URLSearchParams(window.location.search);
    if (!params.has('utm_source')) {
      // Manually store lead source from campaign config
      const data = {
        source: config.source,
        medium: config.medium,
        campaign: config.campaign,
        content: '',
        term: '',
        referrer: document.referrer || '',
        landingPage: window.location.href,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem('rcrs_lead_source', JSON.stringify({
        ...data,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }));
    }

    trackingService.trackPageView(window.location.pathname, config.title);
  }, [config]);

  const sourcePage = `Landing Page: ${config.slug}`;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-green/10 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-brand-green/20 text-brand-green px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <Shield className="w-4 h-4" />
            Licensed &amp; Insured · North Alabama
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">
            {config.headline}
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            {config.subheadline}
          </p>

          {/* Phone CTA */}
          {config.showPhoneCTA !== false && (
            <a
              href="tel:256-274-8530"
              onClick={() => trackingService.trackPhoneClick('256-274-8530', sourcePage)}
              className="inline-flex items-center gap-3 bg-brand-green hover:bg-lime-400 text-black font-bold py-4 px-8 rounded-full text-lg transition-all shadow-lg hover:shadow-xl mb-8"
            >
              <Phone className="w-5 h-5" />
              Call (256) 274-8530
            </a>
          )}
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="py-12 px-4" id="form">
        <div className="max-w-3xl mx-auto">
          <ContactForm
            showContactInfo={false}
            darkMode={true}
            sourcePage={sourcePage}
            preselectedTeamMember={config.assignedRep}
          />
        </div>
      </section>

      {/* Trust Badges */}
      {config.showTrustBadges !== false && (
        <section className="py-12 px-4 border-t border-white/10">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white text-center mb-8">
              Why North Alabama Trusts Us
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Star, label: '5-Star Rated', detail: 'Google & BBB' },
                { icon: Shield, label: 'Fully Insured', detail: 'Licensed & bonded' },
                { icon: Clock, label: 'Fast Response', detail: 'Same-day inspections' },
                { icon: Award, label: 'Insurance Experts', detail: 'We handle your claim' },
              ].map(({ icon: Icon, label, detail }) => (
                <div key={label} className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                  <Icon className="w-8 h-8 text-brand-green mx-auto mb-2" />
                  <div className="text-white font-semibold text-sm">{label}</div>
                  <div className="text-gray-400 text-xs">{detail}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <section className="py-12 px-4 text-center border-t border-white/10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 text-brand-green mb-4">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold">100% Free • No Obligation</span>
          </div>
          <p className="text-gray-400 text-sm">
            River City Roofing Solutions · 3325 Central Pkwy SW, Decatur, AL 35603
          </p>
        </div>
      </section>
    </div>
  );
}
