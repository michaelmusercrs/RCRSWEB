import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GraduationCap, Heart, Users, CheckCircle2, ArrowRight, Phone, Mail, Star, School, Trophy, DollarSign } from 'lucide-react';
import type { Metadata } from 'next';
import { generateMetadata as genMeta, siteConfig, getStructuredDataScript } from '@/lib/seo';

export const metadata: Metadata = genMeta({
  title: 'Raise the Roof for Schools | River City Roofing Solutions',
  description:
    'Every roof replacement means ~$250 donated to the school of your choice. River City Roofing Solutions has donated over $100K to local schools and youth sports across North Alabama.',
  keywords: [
    'roofing school donation',
    'raise the roof for schools',
    'community roofing program',
    'North Alabama school donations',
    'roofing referral program',
    'Decatur roofing community',
    'Huntsville roofing charity',
    'roofing gives back',
  ],
  path: '/referral-rewards',
});

function getReferralProgramSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Raise the Roof for Schools - River City Roofing Solutions',
    description:
      'With every roof replacement, RCRS donates ~$250 to the school of the customer\'s choice.',
    url: `${siteConfig.url}/referral-rewards`,
    mainEntity: {
      '@type': 'Offer',
      name: 'Raise the Roof for Schools Program',
      description:
        'Approximately $250 donated to the school of the customer\'s choice with every roof replacement.',
      seller: {
        '@type': 'RoofingContractor',
        name: siteConfig.name,
        telephone: siteConfig.phone,
        url: siteConfig.url,
      },
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Raise the Roof for Schools',
          item: `${siteConfig.url}/referral-rewards`,
        },
      ],
    },
  };
}

export default function ReferralRewardsPage() {
  const structuredData = getReferralProgramSchema();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: getStructuredDataScript(structuredData) }}
      />
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="relative bg-[#1a1a1a] min-h-[50vh] flex items-center justify-center overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=2070&q=80')",
            }}
          />
          <div className="relative z-10 container mx-auto px-4 text-center text-white py-20">
            <div className="inline-flex items-center gap-2 bg-brand-green/20 border border-brand-green/40 rounded-full px-5 py-2 mb-6">
              <GraduationCap className="text-brand-green" size={20} />
              <span className="text-brand-green font-semibold">Community Program</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg leading-tight">
              Raise the Roof{' '}
              <span className="text-brand-green">for Schools</span>
            </h1>
            <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md mb-4">
              Every new roof helps build a brighter future for local students
            </p>
            <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
              With every roof replacement, RCRS donates approximately{' '}
              <strong className="text-brand-green text-xl">$250</strong> to the school of{' '}
              <em>your</em> choice.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                className="bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-6 text-lg"
              >
                <Link href="/contact">Get a Free Inspection</Link>
              </Button>
              <Button
                asChild
                className="border-2 border-white text-white hover:bg-white hover:text-black font-bold px-8 py-6 text-lg"
              >
                <Link href="tel:256-274-8530">Call (256) 274-8530</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Impact Stats */}
        <section className="bg-brand-green py-10">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
              {[
                { value: '$100K+', label: 'Donated to Community' },
                { value: '~$250', label: 'Per Roof Replacement' },
                { value: '10+', label: 'Schools Supported' },
                { value: '25+', label: 'Years in North Alabama' },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-3xl md:text-4xl font-black mb-1">{s.value}</div>
                  <p className="text-sm md:text-base font-medium text-white/90">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 md:py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                How It <span className="text-brand-green">Works</span>
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Three simple steps — your new roof supports local education.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  step: '1',
                  icon: Phone,
                  title: 'Schedule Your Free Inspection',
                  desc: 'Contact us for a no-obligation roof inspection. We\'ll assess your roof and provide an honest recommendation.',
                },
                {
                  step: '2',
                  icon: School,
                  title: 'Choose Your School',
                  desc: 'When your roof replacement is complete, tell us which local school you\'d like to support. Any school in our service area qualifies.',
                },
                {
                  step: '3',
                  icon: Heart,
                  title: 'We Make the Donation',
                  desc: 'RCRS donates approximately $250 to the school of your choice. Your new roof protects your home AND supports local education.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.step}
                    className="bg-gray-50 rounded-xl p-8 text-center relative border border-gray-100"
                  >
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-green text-white font-bold w-8 h-8 rounded-full flex items-center justify-center">
                      {item.step}
                    </div>
                    <div className="bg-brand-green/10 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                      <Icon className="text-brand-green" size={32} />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                    <p className="text-gray-600">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Community Impact */}
        <section className="py-16 md:py-20 bg-[#1a1a1a] text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-bold mb-4">
                  Our Community <span className="text-brand-green">Impact</span>
                </h2>
                <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                  RCRS has proudly donated over $100,000 to local schools and youth sports organizations
                  across North Alabama.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  'River City Netreapers',
                  'Decatur High School',
                  'Austin High School',
                  'Decatur Heritage',
                  'Local Youth Sports',
                  'And Many More',
                ].map((org) => (
                  <div
                    key={org}
                    className="bg-gray-800 rounded-lg p-5 text-center border border-gray-700 hover:border-brand-green transition"
                  >
                    <Trophy className="text-brand-green mx-auto mb-2" size={24} />
                    <p className="font-semibold">{org}</p>
                  </div>
                ))}
              </div>

              <div className="text-center mt-10">
                <Link
                  href="/community"
                  className="inline-flex items-center gap-2 text-brand-green font-semibold hover:underline text-lg"
                >
                  See Our Full Community Involvement <ArrowRight size={20} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Why Choose RCRS */}
        <section className="py-16 md:py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold mb-4">
                  Why Choose <span className="text-brand-green">RCRS?</span>
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {[
                  {
                    title: '25+ Years of Experience',
                    desc: 'Our owners have been roofing for over 25 years — selling, project managing, and running crews.',
                  },
                  {
                    title: 'OC Preferred & IKO Craftsman Premier',
                    desc: 'Top-tier manufacturer certifications that most roofers can\'t claim.',
                  },
                  {
                    title: '$100K+ Donated to Community',
                    desc: 'We put our money where our mouth is — supporting schools, sports, and local organizations.',
                  },
                  {
                    title: 'Free Honest Inspections',
                    desc: 'We\'ll tell you the truth about your roof — even if it means we don\'t get the job.',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4 p-4">
                    <CheckCircle2
                      className="text-brand-green flex-shrink-0 mt-1"
                      size={24}
                    />
                    <div>
                      <h3 className="font-bold text-lg">{item.title}</h3>
                      <p className="text-gray-600 mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-brand-green">
          <div className="container mx-auto px-4 text-center">
            <GraduationCap className="text-white mx-auto mb-4" size={48} />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Your New Roof Can Make a Difference
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Protect your home and support local education at the same time. Schedule your free
              inspection today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="inline-block bg-white text-brand-green font-bold px-8 py-4 rounded text-lg hover:bg-gray-100 transition"
              >
                Schedule Free Inspection
              </Link>
              <a
                href="tel:256-274-8530"
                className="inline-flex items-center justify-center gap-2 border-2 border-white text-white font-bold px-8 py-4 rounded text-lg hover:bg-white hover:text-brand-green transition"
              >
                <Phone size={20} /> (256) 274-8530
              </a>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="py-12 md:py-16 bg-[#1a1a1a]">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Questions About the Program?
              </h2>
              <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
                We&apos;d love to tell you more about how your roof replacement can support local
                schools.
              </p>

              <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto mb-8">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <Phone className="text-brand-green mx-auto mb-3" size={32} />
                  <p className="text-gray-400 text-sm mb-2">Call Us</p>
                  <a
                    href="tel:256-274-8530"
                    className="text-xl font-bold text-white hover:text-brand-green transition-colors"
                  >
                    (256) 274-8530
                  </a>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <Mail className="text-brand-green mx-auto mb-3" size={32} />
                  <p className="text-gray-400 text-sm mb-2">Email Us</p>
                  <a
                    href="mailto:rcrs@rivercityroofingsolutions.com"
                    className="text-lg font-bold text-white hover:text-brand-green transition-colors"
                  >
                    rcrs@rivercityroofingsolutions.com
                  </a>
                </div>
              </div>

              <p className="text-gray-500 text-sm">
                Program details: Donation of approximately $250 per completed roof replacement to
                the school of the customer&apos;s choice within our service area. Applies to full roof
                replacements only. River City Roofing Solutions reserves the right to modify or
                discontinue this program at any time.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
