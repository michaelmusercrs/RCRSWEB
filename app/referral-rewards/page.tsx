import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Gift, DollarSign, Users, CheckCircle2, ArrowRight, Phone, Mail, Star, Heart, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import { generateMetadata as genMeta, siteConfig, getStructuredDataScript } from '@/lib/seo';

export const metadata: Metadata = genMeta({
  title: 'Referral Rewards Program - Earn $200 Per Referral',
  description: 'Earn $200 cash for every friend, family member, or neighbor you refer to River City Roofing Solutions. No limit on referrals - refer 5 friends and earn $1,000! Share quality roofing services with people you trust.',
  keywords: [
    'roofing referral program',
    'referral rewards',
    'earn money referring roofers',
    'roofing referral bonus',
    'refer a friend roofing',
    'North Alabama roofing referral',
    'Huntsville roofing referral',
    'Decatur roofing referral',
    '$200 referral bonus',
  ],
  path: '/referral-rewards',
});

// Structured data for the referral program
function getReferralProgramSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Referral Rewards Program - River City Roofing Solutions',
    description: 'Earn $200 for every successful roofing referral. No limit on referrals.',
    url: `${siteConfig.url}/referral-rewards`,
    mainEntity: {
      '@type': 'Offer',
      name: 'Referral Rewards Program',
      description: 'Earn $200 cash for every friend, family member, or neighbor you refer who completes a roofing project with River City Roofing Solutions.',
      price: '200',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
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
        { '@type': 'ListItem', position: 2, name: 'Referral Rewards', item: `${siteConfig.url}/referral-rewards` },
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
        <section className="min-h-[50vh] flex items-center justify-center">
          <div className="container mx-auto px-4 text-center text-white">
            <div className="inline-flex items-center gap-2 bg-brand-green/20 border border-brand-green/40 rounded-full px-4 py-2 mb-6">
              <Gift className="text-brand-green" size={20} />
              <span className="text-brand-green font-semibold">Referral Rewards Program</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
              Share the Love, <span className="text-brand-green">Earn $200!</span>
            </h1>
            <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md mb-8">
              Know someone who needs roofing help? Refer them to us and you will both benefit from our Referral Rewards Program!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-6 text-lg">
                <Link href="/contact">Refer Someone Now</Link>
              </Button>
              <Button asChild className="border-2 border-white text-white hover:bg-white hover:text-black font-bold px-8 py-6 text-lg">
                <Link href="tel:256-274-8530">Call (256) 274-8530</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-16 md:py-24 bg-black/80 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                How It Works
              </h2>
              <p className="text-xl text-neutral-300 max-w-2xl mx-auto">
                Three simple steps to earn your $200 referral reward
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  step: '1',
                  icon: Users,
                  title: 'Spread the Word',
                  desc: 'Tell your friends, family, and neighbors about your positive experience with River City Roofing Solutions.',
                },
                {
                  step: '2',
                  icon: CheckCircle2,
                  title: 'They Get Quality Service',
                  desc: 'When they contact us for a roofing project (repair, replacement, or maintenance), they will receive the same great service you did.',
                },
                {
                  step: '3',
                  icon: DollarSign,
                  title: 'You Get Rewarded',
                  desc: 'Once their project is complete, you receive $200 as our thank-you for the referral!',
                },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="bg-neutral-800 border border-neutral-700 hover:border-brand-green transition-all p-8 rounded-lg text-center relative">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-green text-black font-bold w-8 h-8 rounded-full flex items-center justify-center">
                      {item.step}
                    </div>
                    <div className="bg-neutral-700 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                      <Icon className="text-brand-green" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-neutral-300">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Why Refer Section */}
        <section className="py-16 md:py-24 bg-brand-blue/90 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Why Refer River City Roofing?
              </h2>
              <p className="text-xl text-blue-100 max-w-2xl mx-auto">
                You are not just recommending a company - you are helping someone protect their biggest investment
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {[
                {
                  icon: Star,
                  title: 'Trusted by the Community',
                  desc: 'Family-owned, locally operated, and committed to doing the job right',
                },
                {
                  icon: Zap,
                  title: 'Fast & Reliable',
                  desc: 'We show up on time, communicate clearly, and finish the job right the first time',
                },
                {
                  icon: CheckCircle2,
                  title: 'Certified Excellence',
                  desc: 'IKO RoofPro Certified and fully insured for your peace of mind',
                },
                {
                  icon: Heart,
                  title: 'Customer First',
                  desc: 'We treat every home like our own, ensuring satisfaction on every project',
                },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
                    <div className="bg-brand-green rounded-full p-3 w-14 h-14 mx-auto mb-4 flex items-center justify-center">
                      <Icon className="text-white" size={28} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-blue-100 text-sm">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Terms & Guidelines */}
        <section className="py-16 md:py-24 bg-black/70 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
                Program Details
              </h2>

              <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-8">
                <h3 className="text-xl font-bold text-brand-green mb-4">Easy Referral Guidelines:</h3>
                <ul className="space-y-4 text-neutral-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span>Your referral must mention your name when they contact us</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span>Applies to residential and commercial roofing projects (repairs, replacements, or maintenance)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span>Reward is paid once the referred project is complete</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span>There is no limit to the number of referrals - refer as many people as you would like!</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 bg-gradient-to-r from-brand-green/20 to-lime-500/20 border border-brand-green/40 rounded-lg p-8 text-center">
                <h3 className="text-2xl font-bold text-white mb-3">No Limit on Rewards!</h3>
                <p className="text-neutral-300 text-lg">
                  Refer 5 friends? That is <span className="text-brand-green font-bold">$1,000</span> in your pocket!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-24 bg-black/80 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <Gift className="text-brand-green mx-auto mb-6" size={64} />
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Ready to Start Referring?
              </h2>
              <p className="text-xl text-neutral-300 mb-8 max-w-2xl mx-auto">
                It is easy! Just have your friend call us or fill out our contact form and mention your name. We will take it from there!
              </p>

              <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto mb-8">
                <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6">
                  <Phone className="text-brand-green mx-auto mb-3" size={32} />
                  <p className="text-neutral-400 text-sm mb-2">Call Us</p>
                  <a href="tel:256-274-8530" className="text-xl font-bold text-white hover:text-brand-green transition-colors">
                    (256) 274-8530
                  </a>
                </div>
                <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6">
                  <Mail className="text-brand-green mx-auto mb-3" size={32} />
                  <p className="text-neutral-400 text-sm mb-2">Email Us</p>
                  <a href="mailto:info@rivercityroofingsolutions.com" className="text-lg font-bold text-white hover:text-brand-green transition-colors">
                    info@rivercityroofingsolutions.com
                  </a>
                </div>
              </div>

              <Button asChild className="bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-6 text-lg">
                <Link href="/contact">
                  Submit a Referral
                  <ArrowRight className="ml-2" size={20} />
                </Link>
              </Button>

              <p className="text-neutral-400 mt-8 text-sm">
                Thank you for being part of the River City Roofing family!
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
