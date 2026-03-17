import Link from 'next/link';
import { generateMetadata as genMeta, siteConfig, getStructuredDataScript } from '@/lib/seo';
import BNIPartnerForm from './BNIPartnerForm';
import type { Metadata } from 'next';

export const metadata: Metadata = genMeta({
  title: 'Our Trusted Network - BNI Partners',
  description: 'River City Roofing Solutions partners with trusted local professionals through BNI. Find recommended insurance agents, real estate professionals, financial advisors, and more.',
  keywords: [
    'BNI partners',
    'trusted professionals',
    'Athens Alabama',
    'Huntsville Alabama',
    'BNI Limestone Leaders',
    'business referral network',
    'local professionals',
    'BNI Alabama',
    'trusted network',
    'professional directory',
  ],
  path: '/bni',
});

function getBNIPartnerSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Our Trusted Network - BNI Partners - River City Roofing Solutions',
    description: 'River City Roofing Solutions partners with trusted local professionals through BNI. Find recommended insurance agents, real estate professionals, financial advisors, and more.',
    url: `${siteConfig.url}/bni`,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
        { '@type': 'ListItem', position: 2, name: 'BNI Partners', item: `${siteConfig.url}/bni` },
      ],
    },
  };
}

const limestoneLeaders = [
  { name: 'Ali Elizabeth Turner', business: 'Athens Now', category: 'Media Services', website: 'https://athensnowal.net', phone: '(256) 468-9425', color: '#E91E63' },
  { name: 'Amy Fiscus', business: 'Vollara', category: 'Health & Wellness Products', website: 'https://vollara.com', phone: '(256) 337-5727', color: '#00BCD4' },
  { name: 'Austin Duran', business: 'Machen McChesney', category: 'Certified Public Accountant (CPA)', website: '', phone: '(334) 332-4241', color: '#4CAF50' },
  { name: 'Bill Downs', business: 'D&D Agri Insurance', category: 'Agriculture Insurance', website: '', phone: '(256) 431-1780', color: '#2196F3' },
  { name: 'Darla Bunker', business: 'Crye-Leike Realtors', category: 'Property Management', website: 'https://darlabunker.crye-leike.com', phone: '(256) 497-3297', color: '#9C27B0' },
  { name: 'Heidi Richey', business: 'Planet Home Lending', category: 'Residential Mortgages', website: '', phone: '(256) 426-2733', color: '#FF9800' },
  { name: 'Katie Mucci', business: 'Alfa Insurance', category: 'Property & Casualty Insurance', website: 'https://www.alfainsurance.com', phone: '(256) 658-2619', color: '#F44336' },
  { name: 'Melinda Dugger', business: "Dugger's Florist", category: 'Florist', website: 'https://duggersflorist.com', phone: '(256) 232-5777', color: '#E91E63' },
  { name: 'Mona Marcy', business: 'Cypress Building and Construction', category: 'Builder / General Contractor', website: '', phone: '(256) 738-8956', color: '#795548' },
  { name: 'Randy McKinney', business: 'Athens Athletics', category: 'Promotional Products', website: 'https://athensathletics.com', phone: '(256) 232-6038', color: '#FF5722' },
  { name: 'Robin Gerrish', business: 'Crye-Leike Realtors', category: 'Residential Real Estate Agent', website: 'https://robingerrish.crye-leike.com', phone: '(256) 374-9139', color: '#FF9800' },
  { name: 'Stephanie Reynolds', business: 'Athens-Limestone County Tourism', category: 'Non-Profit / Community', website: '', phone: '(256) 232-5411', color: '#1976D2' },
  { name: 'Wes Atkinson', business: 'The Law Office of J. Wesley Atkinson', category: 'Title Services', website: '', phone: '(256) 651-8336', color: '#607D8B' },
];

const trcHuntsville = [
  { name: 'Ashley Patton', business: 'Aflac', category: 'Supplemental Insurance', website: '', phone: '(256) 702-6030', color: '#2196F3' },
  { name: 'Chris Carter', business: 'Alabama Climate Control', category: 'HVAC - Heating & Air', website: '', phone: '(256) 536-8305', color: '#FF5722' },
  { name: 'Diane Bryan', business: 'Lotus Estate Sales', category: 'Estate & Liquidation Sales', website: 'https://lotusestatesales.com', phone: '(256) 975-6000', color: '#AB47BC' },
  { name: 'Jeff Ley', business: 'Arrow Property Management', category: 'Property Management', website: '', phone: '(256) 207-8176', color: '#4CAF50' },
  { name: 'Jim Richardson', business: 'Restaurant Equipment Warehouse', category: 'Restaurant Supply', website: '', phone: '(205) 567-1656', color: '#FF9800' },
  { name: 'Kristy Poole', business: 'Premier Bank of the South', category: 'Banking Services', website: 'https://premierbankofthesouth.com', phone: '(256) 461-8026', color: '#009688' },
  { name: 'Nancy Corlett', business: 'Corlett Collision Repair', category: 'Auto Body Shop', website: 'https://corlettauto.com', phone: '(256) 539-2451', color: '#EF6C00' },
  { name: 'Phillips Kling', business: 'Madison Street Wealth Advisors', category: 'Financial Advisor (Raymond James)', website: '', phone: '(256) 947-5091', color: '#3F51B5' },
  { name: 'Richard Schrimsher', business: 'Alfa Insurance', category: 'Property & Casualty Insurance', website: 'https://www.alfainsurance.com', phone: '(256) 883-8598', color: '#F44336' },
  { name: 'Robert Baugh', business: 'Stockton Mortgage', category: 'Residential Mortgages', website: '', phone: '(256) 503-7747', color: '#795548' },
];

function PartnerCard({ partner }: { partner: typeof limestoneLeaders[0] }) {
  const initial = partner.business.charAt(0).toUpperCase();

  return (
    <div className="bg-neutral-800 border border-neutral-700 hover:border-brand-green/40 rounded-xl p-6 transition-all">
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
          style={{ backgroundColor: partner.color }}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-bold text-lg leading-tight">{partner.business}</h3>
          <p className="text-neutral-400 text-sm mt-1">{partner.category}</p>
          <p className="text-neutral-500 text-sm mt-1">{partner.name}</p>
          <div className="flex flex-wrap gap-3 mt-3">
            {partner.website && (
              <a
                href={partner.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-green text-sm hover:underline"
              >
                Visit Website &rarr;
              </a>
            )}
            {partner.phone && (
              <a
                href={`tel:${partner.phone.replace(/[^0-9+]/g, '')}`}
                className="text-neutral-300 text-sm hover:text-brand-green transition-colors"
              >
                {partner.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BNIPage() {
  const structuredData = getBNIPartnerSchema();
  const allPartners = [...limestoneLeaders, ...trcHuntsville];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: getStructuredDataScript(structuredData) }}
      />
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="min-h-[50vh] flex items-center justify-center">
          <div className="container mx-auto px-4 text-center text-white">
            <div className="inline-flex items-center gap-2 bg-brand-green/20 border border-brand-green/40 rounded-full px-4 py-2 mb-6">
              <span className="text-brand-green font-semibold">BNI Trusted Network</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
              Our <span className="text-brand-green">Trusted Partners</span>
            </h1>
            <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md mb-8">
              We partner with the best local professionals through BNI (Business Network International).
              When you work with us, you have access to our entire network of vetted, trusted experts.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#partners"
                className="inline-flex items-center justify-center bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-4 rounded-lg text-lg transition-colors"
              >
                Browse Partners
              </a>
              <a
                href="tel:256-274-8530"
                className="inline-flex items-center justify-center border-2 border-white text-white hover:bg-white hover:text-black font-bold px-8 py-4 rounded-lg text-lg transition-colors"
              >
                Call (256) 274-8530
              </a>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                How It Works
              </h2>
              <p className="text-xl text-neutral-300 max-w-2xl mx-auto">
                Getting connected with a trusted professional is easy
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  step: '1',
                  title: 'Browse Our Network',
                  desc: 'Find the professional you need from our directory of trusted BNI partners.',
                },
                {
                  step: '2',
                  title: 'Request an Introduction',
                  desc: "Fill out the form and we'll personally introduce you to the right partner.",
                },
                {
                  step: '3',
                  title: 'Get Expert Help',
                  desc: 'Work with a professional we know and trust — the same ones we recommend to our own family.',
                },
              ].map((item, idx) => (
                <div key={idx} className="bg-neutral-800 border border-neutral-700 rounded-lg p-8 text-center relative">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-green text-black font-bold w-8 h-8 rounded-full flex items-center justify-center text-sm">
                    {item.step}
                  </div>
                  <div className="bg-neutral-700 rounded-full w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                    <span className="text-brand-green text-2xl font-bold">{item.step}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-neutral-300">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Limestone Leaders Partners Grid */}
        <section id="partners" className="py-12 md:py-16 bg-neutral-900/90 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                BNI Limestone Leaders — Athens, AL
              </h2>
              <p className="text-xl text-neutral-300 max-w-3xl mx-auto">
                Our chapter meets every Tuesday in Athens. Each member is the exclusive representative for their profession.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {limestoneLeaders.map((partner, idx) => (
                <PartnerCard key={idx} partner={partner} />
              ))}
            </div>
          </div>
        </section>

        {/* TRC Huntsville Partners */}
        <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                BNI Trusted Resource Connection — Huntsville, AL
              </h2>
              <p className="text-xl text-neutral-300 max-w-3xl mx-auto">
                Additional trusted professionals from our Huntsville network.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {trcHuntsville.map((partner, idx) => (
                <PartnerCard key={idx} partner={partner} />
              ))}
            </div>
          </div>
        </section>

        {/* Referral Form Section */}
        <section className="py-12 md:py-16 bg-neutral-900/90 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Need a Trusted Professional?
              </h2>
              <p className="text-xl text-neutral-300 max-w-2xl mx-auto">
                Select a partner below and we&apos;ll make the introduction. No cost, no obligation — just a personal recommendation from our team.
              </p>
            </div>

            <BNIPartnerForm partners={allPartners} />
          </div>
        </section>

        {/* About BNI Section */}
        <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                What is BNI?
              </h2>
              <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-8 md:p-10 text-left space-y-4">
                <p className="text-neutral-300 text-lg leading-relaxed">
                  <strong className="text-white">BNI (Business Network International)</strong> is the world&apos;s largest business referral organization. Members are hand-selected professionals — only one per profession per chapter. When you work with a BNI partner, you&apos;re working with someone who has been vetted and trusted by their peers.
                </p>
                <p className="text-neutral-300 text-lg leading-relaxed">
                  <span className="text-brand-green font-semibold">River City Roofing Solutions</span> is proud to hold the Roofing &amp; Gutters seat in BNI Limestone Leaders.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA Section */}
        <section className="py-12 md:py-16 bg-neutral-900/90 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Questions About Our Network?
              </h2>

              <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto mb-8">
                <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6">
                  <p className="text-neutral-400 text-sm mb-2">Call or Text</p>
                  <a href="tel:256-274-8530" className="text-xl font-bold text-white hover:text-brand-green transition-colors">
                    (256) 274-8530
                  </a>
                </div>
                <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6">
                  <p className="text-neutral-400 text-sm mb-2">Email</p>
                  <a href="mailto:rcrs@rivercityroofingsolutions.com" className="text-lg font-bold text-white hover:text-brand-green transition-colors">
                    rcrs@rivercityroofingsolutions.com
                  </a>
                </div>
              </div>

              <Link
                href="/"
                className="inline-flex items-center justify-center bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-4 rounded-lg text-lg transition-colors"
              >
                Back to Home
              </Link>

              <p className="text-neutral-500 mt-8 text-sm">
                River City Roofing Solutions — Proudly connecting our customers with trusted professionals.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
