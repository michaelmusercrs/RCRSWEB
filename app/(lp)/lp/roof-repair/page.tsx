import { Metadata } from 'next';
import Image from 'next/image';
import { generateMetadata as genMeta, generateLocalBusinessSchema, siteConfig } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';
import LandingPageForm from '@/components/LandingPageForm';

export const metadata: Metadata = genMeta({
  title: 'Emergency Roof Repair in North Alabama | Free Inspection',
  description: 'Same-day emergency roof repair in Decatur, Huntsville & North Alabama. Licensed & insured. Free inspection. IKO ROOFPRO Craftsman Premier certified. Call (256) 274-8530.',
  keywords: [
    'emergency roof repair North Alabama',
    'roof repair Decatur AL',
    'roof repair Huntsville AL',
    'leaking roof repair near me',
    'storm damage roof repair',
    'missing shingles repair',
    'roof leak repair same day',
    'emergency roofer near me',
  ],
  path: '/lp/roof-repair',
  noindex: true,
});

export default function RoofRepairLandingPage() {
  const localBusinessSchema = generateLocalBusinessSchema();

  return (
    <div className="min-h-screen bg-black text-white">
      <StructuredData data={localBusinessSchema} />

      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center px-4 py-16 overflow-hidden">
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(57,255,20,0.08),transparent_70%)]" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Logo */}
          <Image
            src="/logo-nobg.png"
            alt="River City Roofing Solutions"
            width={200}
            height={136}
            className="mx-auto mb-6 w-40 md:w-52 h-auto"
            priority
          />

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black uppercase tracking-wider leading-tight mb-4">
            Emergency Roof Repair<br />
            <span className="text-brand-green">in North Alabama</span>
          </h1>

          <p className="text-lg md:text-xl text-neutral-300 max-w-2xl mx-auto mb-6">
            Same-day response. Licensed &amp; insured. Free inspection.
          </p>

          {/* Urgency badge */}
          <div className="inline-flex items-center gap-2 bg-red-600/20 border border-red-500/50 text-red-400 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-widest mb-8">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            We Respond Within 1 Hour
          </div>

          {/* Click-to-call */}
          <div className="mb-8">
            <a
              href="tel:256-274-8530"
              className="inline-flex items-center gap-3 bg-brand-green text-black font-black uppercase tracking-widest px-8 py-4 rounded-lg text-lg hover:bg-lime-400 transition-all shadow-lg shadow-brand-green/20"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call (256) 274-8530
            </a>
          </div>
        </div>
      </section>

      {/* Pain Points + Form */}
      <section className="py-12 md:py-16 px-4 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            {/* Left: Pain points */}
            <div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-wider mb-6">
                Is Your Roof <span className="text-brand-green">Leaking?</span>
              </h2>

              <div className="space-y-4 mb-8">
                {[
                  {
                    title: 'Leaking Roof',
                    desc: 'Water stains on your ceiling? Act now before it causes structural damage and mold.',
                  },
                  {
                    title: 'Storm Damage',
                    desc: 'Hail, wind, or fallen debris? We document everything for your insurance claim.',
                  },
                  {
                    title: 'Missing Shingles',
                    desc: 'Exposed underlayment means your home is vulnerable. We fix it fast.',
                  },
                  {
                    title: 'Emergency Tarping',
                    desc: 'Need immediate protection? We offer same-day emergency tarp service.',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4 items-start">
                    <div className="w-8 h-8 bg-brand-green/15 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <svg className="w-5 h-5 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-black uppercase tracking-wider text-white text-sm mb-1">{item.title}</h3>
                      <p className="text-neutral-400 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Why choose us */}
              <div className="bg-black border border-neutral-800 rounded-xl p-6">
                <h3 className="font-black uppercase tracking-wider text-brand-green text-sm mb-4">Why River City Roofing?</h3>
                <ul className="space-y-2">
                  {[
                    'Same-day emergency response',
                    'Free inspection — no obligation',
                    'Licensed, bonded & insured',
                    'We work with ALL insurance companies',
                    'Family-owned, locally operated',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-neutral-300 text-sm">
                      <svg className="w-4 h-4 text-brand-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right: Form */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 md:p-8 lg:sticky lg:top-8">
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-center mb-2">
                Get Your <span className="text-brand-green">Free Inspection</span>
              </h2>
              <p className="text-neutral-400 text-sm text-center mb-6">
                No cost. No obligation. Fast response.
              </p>

              <LandingPageForm
                ctaText="Get Free Inspection"
                serviceType="Emergency Roof Repair"
                sourcePage="lp/roof-repair"
                showAddress={true}
                showDescription={true}
                descriptionPlaceholder="Describe the issue (leaking, missing shingles, storm damage, etc.)"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-10 px-4 bg-black border-t border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { title: 'IKO ROOFPRO\u00AE', subtitle: 'Craftsman Premier', icon: '\u2605' },
              { title: 'BBB A+ Rated', subtitle: 'Accredited Business', icon: '\u2713' },
              { title: '5.0 Google Rating', subtitle: '\u2605\u2605\u2605\u2605\u2605', icon: '\u2605' },
              { title: 'Licensed & Insured', subtitle: 'Full Coverage', icon: '\u26E8' },
            ].map((badge) => (
              <div key={badge.title} className="text-center p-4 bg-neutral-950 border border-neutral-800 rounded-xl">
                <div className="text-brand-green text-2xl mb-2">{badge.icon}</div>
                <p className="font-black uppercase tracking-wider text-xs text-white">{badge.title}</p>
                <p className="text-neutral-500 text-xs mt-1">{badge.subtitle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-10 px-4 bg-brand-green/95 text-black border-t border-neutral-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-wider mb-3">
            Don&apos;t Wait — Roof Damage Gets Worse
          </h2>
          <p className="text-black/70 mb-6 text-lg">
            Every hour you wait, water damage spreads. Get your free inspection today.
          </p>
          <a
            href="tel:256-274-8530"
            className="inline-flex items-center gap-3 bg-black text-brand-green font-black uppercase tracking-widest px-8 py-4 rounded-lg text-lg hover:bg-neutral-900 transition-all"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Call (256) 274-8530 Now
          </a>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="py-6 px-4 bg-black border-t border-neutral-800 text-center">
        <p className="text-neutral-500 text-xs">
          &copy; {new Date().getFullYear()} River City Roofing Solutions. All rights reserved.
          <br />
          {siteConfig.address.streetAddress}, {siteConfig.address.addressLocality}, {siteConfig.address.addressRegion} {siteConfig.address.postalCode}
        </p>
      </footer>
    </div>
  );
}
