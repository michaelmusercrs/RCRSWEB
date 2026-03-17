import { Metadata } from 'next';
import Image from 'next/image';
import { generateMetadata as genMeta, generateLocalBusinessSchema, siteConfig } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';
import LandingPageForm from '@/components/LandingPageForm';

export const metadata: Metadata = genMeta({
  title: 'Never Clean Your Gutters Again | LeafX Gutter Guards North Alabama',
  description: 'Professional gutter guard installation in North Alabama. Boral Certified LeafX dealer. No more clogs, no more climbing ladders. Free quote. Call (256) 274-8530.',
  keywords: [
    'gutter guards North Alabama',
    'gutter guards Decatur AL',
    'gutter guards Huntsville AL',
    'LeafX gutter guards',
    'gutter protection installation',
    'no clog gutters',
    'gutter guard installer near me',
    'Boral LeafX dealer Alabama',
    'leaf guard installation',
  ],
  path: '/lp/gutter-guards',
  noindex: true,
});

export default function GutterGuardsLandingPage() {
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
            Never Clean Your<br />
            <span className="text-brand-green">Gutters Again</span>
          </h1>

          <p className="text-lg md:text-xl text-neutral-300 max-w-2xl mx-auto mb-6">
            Boral Certified LeafX dealer. Professional installation. Lifetime protection.
          </p>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-brand-green/15 border border-brand-green/40 text-brand-green px-4 py-2 rounded-full text-sm font-bold uppercase tracking-widest mb-8">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Boral Certified LeafX Dealer &amp; Pro Installer
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
                Why <span className="text-brand-green">LeafX Gutter Guards?</span>
              </h2>

              <div className="space-y-4 mb-8">
                {[
                  {
                    title: 'No More Clogs',
                    desc: 'LeafX gutter guards keep leaves, pine needles, and debris out while letting water flow freely. No more dangerous ladder climbs.',
                  },
                  {
                    title: 'Protect Your Foundation',
                    desc: 'Clogged gutters cause water to overflow and pool around your foundation. Gutter guards prevent costly foundation damage.',
                  },
                  {
                    title: 'Extend Your Roof Life',
                    desc: 'Backed-up gutters cause ice dams and water damage to your fascia, soffit, and roof deck. Protection that pays for itself.',
                  },
                  {
                    title: 'Professional Installation',
                    desc: 'Boral Certified installers ensure your gutter guards are fitted perfectly. No DIY guesswork. Guaranteed results.',
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

              {/* What you avoid */}
              <div className="bg-black border border-neutral-800 rounded-xl p-6">
                <h3 className="font-black uppercase tracking-wider text-brand-green text-sm mb-4">
                  Problems Gutter Guards Solve
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    'Overflowing gutters',
                    'Foundation damage',
                    'Fascia rot',
                    'Ice dams',
                    'Mosquito breeding',
                    'Dangerous ladder climbs',
                    'Landscape erosion',
                    'Basement flooding',
                  ].map((problem) => (
                    <div key={problem} className="flex items-center gap-2 text-neutral-300 text-sm">
                      <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {problem}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Form */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 md:p-8 lg:sticky lg:top-8">
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-center mb-2">
                Get Your <span className="text-brand-green">Free Gutter Quote</span>
              </h2>
              <p className="text-neutral-400 text-sm text-center mb-6">
                See how much you&apos;ll save on gutter maintenance. Free quote, no obligation.
              </p>

              <LandingPageForm
                ctaText="Get Free Gutter Quote"
                serviceType="Gutter Guards / LeafX Installation"
                sourcePage="lp/gutter-guards"
                showAddress={true}
                showDescription={false}
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-10 px-4 bg-black border-t border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-wider mb-8">
            How It <span className="text-brand-green">Works</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: '1',
                title: 'Free Inspection',
                desc: 'We inspect your gutters and recommend the right LeafX solution for your home.',
              },
              {
                step: '2',
                title: 'Professional Install',
                desc: 'Our Boral Certified team installs your gutter guards quickly and cleanly.',
              },
              {
                step: '3',
                title: 'Enjoy Freedom',
                desc: 'No more cleaning. No more clogs. No more climbing ladders. Just protection.',
              },
            ].map((item) => (
              <div key={item.step} className="bg-neutral-950 border border-neutral-800 rounded-xl p-6">
                <div className="w-10 h-10 bg-brand-green text-black rounded-full flex items-center justify-center mx-auto mb-4 font-black text-lg">
                  {item.step}
                </div>
                <h3 className="font-black uppercase tracking-wider text-white text-sm mb-2">{item.title}</h3>
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
              { title: 'Boral Certified', subtitle: 'LeafX Dealer & Installer', icon: '\u26E8' },
              { title: 'IKO ROOFPRO\u00AE', subtitle: 'Craftsman Premier', icon: '\u2605' },
              { title: 'BBB A+ Rated', subtitle: 'Accredited Business', icon: '\u2713' },
              { title: '5.0 Google Rating', subtitle: '\u2605\u2605\u2605\u2605\u2605', icon: '\u2605' },
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
            Stop Cleaning. Start Living.
          </h2>
          <p className="text-black/70 mb-6 text-lg">
            Get a free quote for professional gutter guard installation today.
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
