import { Metadata } from 'next';
import Image from 'next/image';
import { generateMetadata as genMeta, generateLocalBusinessSchema, siteConfig } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';
import LandingPageForm from '@/components/LandingPageForm';

export const metadata: Metadata = genMeta({
  title: 'Storm Damage? We Handle Your Insurance Claim | Free Inspection',
  description: 'Storm damage roof repair in North Alabama. Free inspection. We work directly with your insurance company. Most homeowners pay $0 out of pocket. Call (256) 274-8530.',
  keywords: [
    'storm damage roof repair North Alabama',
    'hail damage roof repair',
    'insurance claim roofing contractor',
    'storm damage Decatur AL',
    'storm damage Huntsville AL',
    'roof insurance claim help',
    'wind damage roof repair',
    'free storm damage inspection',
    'roofing insurance specialist',
  ],
  path: '/lp/storm-damage',
  noindex: true,
});

export default function StormDamageLandingPage() {
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
            Storm Damage?<br />
            <span className="text-brand-green">We Handle Your Insurance Claim</span>
          </h1>

          <p className="text-lg md:text-xl text-neutral-300 max-w-2xl mx-auto mb-6">
            Free inspection. We work directly with your insurance company.
          </p>

          {/* Key stat */}
          <div className="inline-flex items-center gap-2 bg-brand-green/15 border border-brand-green/40 text-brand-green px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-widest mb-8">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Most Homeowners Pay $0 Out of Pocket
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

      {/* Process + Form */}
      <section className="py-12 md:py-16 px-4 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            {/* Left: Process */}
            <div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-wider mb-6">
                Our <span className="text-brand-green">4-Step Process</span>
              </h2>

              <div className="space-y-6 mb-8">
                {[
                  {
                    step: '1',
                    title: 'Free Inspection',
                    desc: 'Our certified inspector examines your roof for hail, wind, and storm damage. Completely free, no strings attached.',
                  },
                  {
                    step: '2',
                    title: 'We Document Everything',
                    desc: 'Detailed photos, measurements, and damage reports. Professional documentation your insurance company needs.',
                  },
                  {
                    step: '3',
                    title: 'We File With Insurance',
                    desc: 'We work directly with your insurance adjuster. We know what they look for and speak their language.',
                  },
                  {
                    step: '4',
                    title: 'Repairs Done Right',
                    desc: 'Once approved, our IKO-certified crew completes the job. Premium materials, clean worksite, guaranteed quality.',
                  },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4 items-start">
                    <div className="w-10 h-10 bg-brand-green text-black rounded-full flex items-center justify-center flex-shrink-0 font-black text-lg">
                      {item.step}
                    </div>
                    <div>
                      <h3 className="font-black uppercase tracking-wider text-white text-sm mb-1">{item.title}</h3>
                      <p className="text-neutral-400 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Check My Address CTA */}
              <div className="bg-black border border-brand-green/30 rounded-xl p-6">
                <h3 className="font-black uppercase tracking-wider text-brand-green text-sm mb-2">
                  Was Your Area Hit by a Storm?
                </h3>
                <p className="text-neutral-400 text-sm mb-4">
                  Use our free storm check tool to see recent hail and storm activity near your property. Real NWS data.
                </p>
                <a
                  href="/check-my-address"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-brand-green/15 border border-brand-green/40 text-brand-green font-bold uppercase tracking-widest px-5 py-2.5 rounded-lg text-sm hover:bg-brand-green/25 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Check My Address
                </a>
              </div>
            </div>

            {/* Right: Form */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 md:p-8 lg:sticky lg:top-8">
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-center mb-2">
                Schedule <span className="text-brand-green">Free Storm Inspection</span>
              </h2>
              <p className="text-neutral-400 text-sm text-center mb-6">
                We&apos;ll inspect your roof and handle the insurance process.
              </p>

              <LandingPageForm
                ctaText="Schedule Free Storm Inspection"
                serviceType="Storm Damage / Insurance Claim"
                sourcePage="lp/storm-damage"
                showAddress={true}
                showDescription={true}
                descriptionPlaceholder="When did the storm hit? What damage have you noticed?"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Insurance Company Logos / Trust */}
      <section className="py-10 px-4 bg-black border-t border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider mb-2">
            We Work With <span className="text-brand-green">All Insurance Companies</span>
          </h2>
          <p className="text-neutral-400 text-sm mb-8">
            State Farm, Allstate, USAA, Liberty Mutual, Farmers, Nationwide, and more.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { title: 'IKO ROOFPRO\u00AE', subtitle: 'Craftsman Premier', icon: '\u2605' },
              { title: 'BBB A+ Rated', subtitle: 'Accredited Business', icon: '\u2713' },
              { title: '5.0 Google Rating', subtitle: '\u2605\u2605\u2605\u2605\u2605', icon: '\u2605' },
              { title: 'Insurance Experts', subtitle: 'Claims Specialists', icon: '\u26E8' },
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

      {/* FAQ-style objections */}
      <section className="py-10 px-4 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-center mb-8">
            Common <span className="text-brand-green">Questions</span>
          </h2>

          <div className="space-y-3">
            {[
              {
                q: 'Will filing a claim raise my insurance rates?',
                a: 'Storm damage claims are classified as "Acts of God" and typically do not raise your premiums. Your insurance is designed for exactly this situation.',
              },
              {
                q: 'How do I know if I have storm damage?',
                a: 'Most storm damage is invisible from the ground. That\'s why we offer free inspections. Our trained inspectors know exactly what to look for.',
              },
              {
                q: 'What if my insurance denies the claim?',
                a: 'We\'ll work with you through the appeals process. Our thorough documentation and professional assessments give your claim the best chance of approval.',
              },
            ].map((faq) => (
              <details key={faq.q} className="bg-black border border-neutral-800 rounded-lg p-5 group hover:border-brand-green transition-colors">
                <summary className="font-black uppercase tracking-wider cursor-pointer list-none flex justify-between items-center text-sm">
                  {faq.q}
                  <svg className="w-5 h-5 text-brand-green flex-shrink-0 ml-4 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="text-neutral-400 mt-3 leading-relaxed text-sm">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-10 px-4 bg-brand-green/95 text-black border-t border-neutral-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-wider mb-3">
            Don&apos;t Let Storm Damage Go Unchecked
          </h2>
          <p className="text-black/70 mb-6 text-lg">
            Insurance claims have time limits. Get your free inspection before it&apos;s too late.
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
