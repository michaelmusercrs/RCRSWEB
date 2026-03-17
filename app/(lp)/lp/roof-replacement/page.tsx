import { Metadata } from 'next';
import Image from 'next/image';
import { generateMetadata as genMeta, generateLocalBusinessSchema, siteConfig } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';
import LandingPageForm from '@/components/LandingPageForm';

export const metadata: Metadata = genMeta({
  title: 'New Roof Starting at $0 Down | Free Estimate North Alabama',
  description: 'New roof replacement starting at $0 down with financing. IKO Dynasty shingles, 5-year workmanship warranty. Free estimate in Decatur, Huntsville & North Alabama. Call (256) 274-8530.',
  keywords: [
    'roof replacement North Alabama',
    'new roof Decatur AL',
    'new roof Huntsville AL',
    'roof replacement financing',
    'roof replacement cost Alabama',
    'IKO Dynasty shingles',
    'roof replacement near me',
    'affordable roof replacement',
    '$0 down roof replacement',
  ],
  path: '/lp/roof-replacement',
  noindex: true,
});

export default function RoofReplacementLandingPage() {
  const localBusinessSchema = generateLocalBusinessSchema();

  return (
    <div className="min-h-screen bg-black text-white">
      <StructuredData data={localBusinessSchema} />

      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center px-4 py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(57,255,20,0.08),transparent_70%)]" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <Image
            src="/logo-nobg.png"
            alt="River City Roofing Solutions"
            width={200}
            height={136}
            className="mx-auto mb-6 w-40 md:w-52 h-auto"
            priority
          />

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black uppercase tracking-wider leading-tight mb-4">
            New Roof Starting at<br />
            <span className="text-brand-green">$0 Down</span>
          </h1>

          <p className="text-lg md:text-xl text-neutral-300 max-w-2xl mx-auto mb-6">
            Financing available. IKO Dynasty shingles. 5-year workmanship warranty.
          </p>

          {/* Value badge */}
          <div className="inline-flex items-center gap-2 bg-brand-green/15 border border-brand-green/40 text-brand-green px-4 py-2 rounded-full text-sm font-bold uppercase tracking-widest mb-8">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Free Estimates &mdash; No Obligation
          </div>

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

      {/* Benefits + Form */}
      <section className="py-12 md:py-16 px-4 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            {/* Left: Benefits */}
            <div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-wider mb-6">
                Why Replace Your <span className="text-brand-green">Roof Now?</span>
              </h2>

              <div className="space-y-4 mb-8">
                {[
                  {
                    title: 'Free In-Home Estimate',
                    desc: 'We come to you. Detailed written estimate with material options and pricing. Zero pressure.',
                  },
                  {
                    title: 'Flexible Financing',
                    desc: 'Multiple financing options available. Get a new roof today, pay over time. As low as $0 down.',
                  },
                  {
                    title: 'IKO Certified Installers',
                    desc: 'IKO ROOFPRO Craftsman Premier certified. Factory-trained crews installing premium Dynasty shingles.',
                  },
                  {
                    title: '5-Year Workmanship Warranty',
                    desc: 'Our work is guaranteed. Plus manufacturer shingle warranties for added peace of mind.',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4 items-start">
                    <div className="w-8 h-8 bg-brand-green/15 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <svg className="w-5 h-5 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-black uppercase tracking-wider text-white text-sm mb-1">{item.title}</h3>
                      <p className="text-neutral-400 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Before/After Placeholder */}
              <div className="bg-black border border-neutral-800 rounded-xl p-6">
                <h3 className="font-black uppercase tracking-wider text-brand-green text-sm mb-4">Our Work Speaks for Itself</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative h-32 rounded-lg overflow-hidden bg-neutral-900">
                    <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold z-10">BEFORE</div>
                    <Image src="/uploads/service-storm.jpg" alt="Before: Aged roof needing replacement" fill className="object-cover" />
                  </div>
                  <div className="relative h-32 rounded-lg overflow-hidden bg-neutral-900">
                    <div className="absolute top-2 left-2 bg-brand-green text-black px-2 py-0.5 rounded text-xs font-bold z-10">AFTER</div>
                    <Image src="/uploads/service-repair.jpg" alt="After: New roof installation complete" fill className="object-cover" />
                  </div>
                </div>
                <p className="text-neutral-500 text-xs mt-3 text-center">IKO Dynasty shingle installation in Huntsville, AL</p>
              </div>
            </div>

            {/* Right: Form */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 md:p-8 lg:sticky lg:top-8">
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-center mb-2">
                Get Your <span className="text-brand-green">Free Estimate</span>
              </h2>
              <p className="text-neutral-400 text-sm text-center mb-6">
                Find out what a new roof will cost. No obligation.
              </p>

              <LandingPageForm
                ctaText="Get Your Free Estimate"
                serviceType="Roof Replacement"
                sourcePage="lp/roof-replacement"
                showAddress={true}
                showDescription={false}
              />
            </div>
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="py-10 px-4 bg-black border-t border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-wider mb-8">
            What&apos;s <span className="text-brand-green">Included</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Full Tear-Off', desc: 'We remove all old shingles down to the deck. No layovers.' },
              { title: 'Premium Materials', desc: 'IKO Dynasty shingles with Class 4 impact resistance.' },
              { title: 'Complete Cleanup', desc: 'Magnetic sweep, debris hauled away. Your yard stays clean.' },
            ].map((item) => (
              <div key={item.title} className="bg-neutral-950 border border-neutral-800 rounded-xl p-6">
                <h3 className="font-black uppercase tracking-wider text-brand-green text-sm mb-2">{item.title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-10 px-4 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { title: 'IKO ROOFPRO\u00AE', subtitle: 'Craftsman Premier', icon: '\u2605' },
              { title: 'BBB A+ Rated', subtitle: 'Accredited Business', icon: '\u2713' },
              { title: '5.0 Google Rating', subtitle: '\u2605\u2605\u2605\u2605\u2605', icon: '\u2605' },
              { title: 'Owens Corning', subtitle: 'Preferred Contractor', icon: '\u2606' },
            ].map((badge) => (
              <div key={badge.title} className="text-center p-4 bg-black border border-neutral-800 rounded-xl">
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
            Your New Roof Starts Here
          </h2>
          <p className="text-black/70 mb-6 text-lg">
            Free estimate. Financing available. Get started today.
          </p>
          <a
            href="tel:256-274-8530"
            className="inline-flex items-center gap-3 bg-black text-brand-green font-black uppercase tracking-widest px-8 py-4 rounded-lg text-lg hover:bg-neutral-900 transition-all"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Call (256) 274-8530
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
