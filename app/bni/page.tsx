import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Gift, DollarSign, Users, CheckCircle2, ArrowRight, Phone, Mail, Handshake, Building2, Award, Shield } from 'lucide-react';
import type { Metadata } from 'next';
import { generateMetadata as genMeta, siteConfig, getStructuredDataScript } from '@/lib/seo';

export const metadata: Metadata = genMeta({
  title: 'BNI Partner Referral Program - Earn $200 Per Referral',
  description: 'Exclusive BNI member referral program: Earn $200 for every client you refer to River City Roofing Solutions. Partner with a trusted, IKO RoofPro certified roofing contractor serving North Alabama.',
  keywords: [
    'BNI referral program',
    'BNI roofing partner',
    'business networking referral',
    'BNI Alabama',
    'BNI Huntsville',
    'BNI Decatur',
    'roofing business referral',
    'contractor referral program',
    'professional referral rewards',
    'BNI member benefits',
  ],
  path: '/bni',
});

// Structured data for BNI partner page
function getBNIPartnerSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'BNI Partner Referral Program - River City Roofing Solutions',
    description: 'Exclusive $200 referral program for BNI members partnering with River City Roofing Solutions.',
    url: `${siteConfig.url}/bni`,
    mainEntity: {
      '@type': 'Offer',
      name: 'BNI Partner Referral Program',
      description: 'BNI members earn $200 for every client referral that results in a completed roofing project.',
      price: '200',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      eligibleCustomerType: 'https://schema.org/Business',
      seller: {
        '@type': 'RoofingContractor',
        name: siteConfig.name,
        telephone: siteConfig.phone,
        url: siteConfig.url,
        areaServed: [
          { '@type': 'City', name: 'Huntsville', containedInPlace: { '@type': 'State', name: 'Alabama' } },
          { '@type': 'City', name: 'Decatur', containedInPlace: { '@type': 'State', name: 'Alabama' } },
          { '@type': 'City', name: 'Madison', containedInPlace: { '@type': 'State', name: 'Alabama' } },
          { '@type': 'City', name: 'Athens', containedInPlace: { '@type': 'State', name: 'Alabama' } },
        ],
        hasCredential: [
          { '@type': 'EducationalOccupationalCredential', credentialCategory: 'certification', name: 'IKO RoofPro Certified' },
        ],
      },
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
        { '@type': 'ListItem', position: 2, name: 'BNI Partner Program', item: `${siteConfig.url}/bni` },
      ],
    },
  };
}

export default function BNIPage() {
  const structuredData = getBNIPartnerSchema();

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
              <Handshake className="text-brand-green" size={20} />
              <span className="text-brand-green font-semibold">BNI Partner Program</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
              Partner With Us, <span className="text-brand-green">Earn $200!</span>
            </h1>
            <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md mb-4">
              Welcome BNI Members! We value your partnership and want to reward you for every referral.
            </p>
            <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
              When you refer a client to River City Roofing Solutions and they complete a roofing project, you will receive <span className="text-brand-green font-bold">$200</span> as our thank-you!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-6 text-lg">
                <Link href="/contact">Send Us a Referral</Link>
              </Button>
              <Button asChild className="border-2 border-white text-white hover:bg-white hover:text-black font-bold px-8 py-6 text-lg">
                <Link href="tel:256-274-8530">Call (256) 274-8530</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Why Partner With Us */}
        <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Why Partner With River City Roofing?
              </h2>
              <p className="text-xl text-neutral-300 max-w-2xl mx-auto">
                Your clients deserve the best - and so do you
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {[
                {
                  icon: Shield,
                  title: 'Reliable & Professional',
                  desc: 'We show up on time, communicate clearly, and complete projects right the first time',
                },
                {
                  icon: Award,
                  title: 'Certified Experts',
                  desc: 'IKO RoofPro Certified and fully insured for complete peace of mind',
                },
                {
                  icon: Users,
                  title: 'Family-Owned Values',
                  desc: 'Locally operated with a commitment to treating every customer like family',
                },
                {
                  icon: Building2,
                  title: 'Full Service',
                  desc: 'Residential & commercial roofing, repairs, replacements, and storm damage restoration',
                },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="bg-neutral-800 border border-neutral-700 hover:border-brand-green transition-all rounded-lg p-6 text-center">
                    <div className="bg-neutral-700 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Icon className="text-brand-green" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-neutral-300 text-sm">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-12 md:py-16 bg-brand-blue/90 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                How The Referral Process Works
              </h2>
              <p className="text-xl text-blue-100 max-w-2xl mx-auto">
                Simple steps to earn your $200 referral reward
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  step: '1',
                  icon: Users,
                  title: 'Refer Your Client',
                  desc: 'When a client mentions they need roofing work, recommend River City Roofing Solutions and let us know about the referral.',
                },
                {
                  step: '2',
                  icon: CheckCircle2,
                  title: 'We Deliver Excellence',
                  desc: 'We provide your client with the same professional, high-quality service that reflects well on your recommendation.',
                },
                {
                  step: '3',
                  icon: DollarSign,
                  title: 'Get Your Reward',
                  desc: 'Once the project is complete, we send you $200 as a thank-you for trusting us with your referral!',
                },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-lg p-8 text-center relative">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-green text-black font-bold w-8 h-8 rounded-full flex items-center justify-center">
                      {item.step}
                    </div>
                    <div className="bg-white/20 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                      <Icon className="text-white" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-blue-100">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Services We Offer */}
        <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Services Your Clients Can Count On
              </h2>
              <p className="text-neutral-300 max-w-2xl mx-auto">
                No matter what roofing challenge they face, we have got them covered
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {[
                'Roof Replacements',
                'Roof Repairs',
                'Storm Damage Restoration',
                'Insurance Claims Assistance',
                'Commercial Roofing',
                'Gutter Installation',
                'Free Inspections',
                'Preventive Maintenance',
                'Emergency Services',
              ].map((service, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-neutral-800/50 border border-neutral-700 rounded-lg p-4">
                  <CheckCircle2 className="text-brand-green flex-shrink-0" size={20} />
                  <span className="text-white">{service}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Referral Guidelines */}
        <section className="py-12 md:py-16 bg-neutral-900/90 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
                Referral Guidelines
              </h2>

              <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-8">
                <ul className="space-y-4 text-neutral-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span>Let us know about your referral (call, text, or email) so we can track it properly</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span>Your referral should mention your name when they contact us</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span>Applies to both residential and commercial roofing projects</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span>Reward paid once the referred project is complete</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span><strong className="text-white">No limit</strong> on the number of referrals - the more you refer, the more you earn!</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 bg-gradient-to-r from-brand-green/20 to-lime-500/20 border border-brand-green/40 rounded-lg p-8 text-center">
                <h3 className="text-2xl font-bold text-white mb-3">Unlimited Earning Potential!</h3>
                <p className="text-neutral-300 text-lg">
                  Refer 10 clients this year? That is <span className="text-brand-green font-bold">$2,000</span> in referral rewards!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <Handshake className="text-brand-green mx-auto mb-6" size={64} />
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Let Us Grow Together
              </h2>
              <p className="text-xl text-neutral-300 mb-8 max-w-2xl mx-auto">
                We are proud to partner with BNI members who share our commitment to quality and service. Ready to send us a referral?
              </p>

              <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto mb-8">
                <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6">
                  <Phone className="text-brand-green mx-auto mb-3" size={32} />
                  <p className="text-neutral-400 text-sm mb-2">Call or Text</p>
                  <a href="tel:256-274-8530" className="text-xl font-bold text-white hover:text-brand-green transition-colors">
                    (256) 274-8530
                  </a>
                </div>
                <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6">
                  <Mail className="text-brand-green mx-auto mb-3" size={32} />
                  <p className="text-neutral-400 text-sm mb-2">Email</p>
                  <a href="mailto:info@rivercityroofingsolutions.com" className="text-lg font-bold text-white hover:text-brand-green transition-colors">
                    info@rivercityroofingsolutions.com
                  </a>
                </div>
              </div>

              <Button asChild className="bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-6 text-lg">
                <Link href="/contact">
                  Submit a Referral Now
                  <ArrowRight className="ml-2" size={20} />
                </Link>
              </Button>

              <p className="text-neutral-400 mt-8 text-sm">
                Thank you for partnering with River City Roofing Solutions!<br />
                Together, we are building trust - one roof at a time.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
