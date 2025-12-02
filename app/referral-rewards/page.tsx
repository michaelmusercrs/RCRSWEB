import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Gift, DollarSign, Users, CheckCircle2, ArrowRight, Phone, Mail, Star, Heart, Zap, FileText, XCircle, AlertCircle } from 'lucide-react';
import type { Metadata } from 'next';
import { generateMetadata as genMeta, siteConfig, getStructuredDataScript } from '@/lib/seo';
import ReferralCalculator from '@/components/ReferralCalculator';
import ReferralForm from '@/components/ReferralForm';

export const metadata: Metadata = genMeta({
  title: 'Referral Rewards Program - Earn Up To $1,000 Per Referral!',
  description: 'Exclusive referral program for River City Roofing customers: Earn $100 to $1,000 per referral! The more you refer, the more you earn. Available to previous customers with completed contracts.',
  keywords: [
    'roofing referral program',
    'referral rewards',
    'earn money referring roofers',
    'roofing referral bonus',
    'refer a friend roofing',
    'North Alabama roofing referral',
    'Huntsville roofing referral',
    'Decatur roofing referral',
    '$1000 referral bonus',
  ],
  path: '/referral-rewards',
});

// Structured data for the referral program
function getReferralProgramSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Referral Rewards Program - River City Roofing Solutions',
    description: 'Earn $100 to $1,000 per referral. Exclusive program for previous customers.',
    url: `${siteConfig.url}/referral-rewards`,
    mainEntity: {
      '@type': 'Offer',
      name: 'Referral Rewards Program',
      description: 'Tiered referral rewards for previous customers: 1st referral $100, 2nd $250, 3rd $500, 4th-10th $1,000 each. Maximum 10 referrals.',
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

  const rewardTiers = [
    { referral: '1st', amount: '$100' },
    { referral: '2nd', amount: '$250' },
    { referral: '3rd', amount: '$500' },
    { referral: '4th', amount: '$1,000' },
    { referral: '5th', amount: '$1,000' },
    { referral: '6th', amount: '$1,000' },
    { referral: '7th', amount: '$1,000' },
    { referral: '8th', amount: '$1,000' },
    { referral: '9th', amount: '$1,000' },
    { referral: '10th', amount: '$1,000' },
  ];

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
              <span className="text-brand-green font-semibold">Exclusive Customer Rewards</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
              Earn Up To <span className="text-brand-green">$1,000</span> Per Referral!
            </h1>
            <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md mb-4">
              Our way of saying THANK YOU to our valued customers
            </p>
            <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
              Refer friends and family to River City Roofing Solutions and watch your rewards grow with every referral!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-6 text-lg">
                <Link href="/contact">Start Referring Now</Link>
              </Button>
              <Button asChild className="border-2 border-white text-white hover:bg-white hover:text-black font-bold px-8 py-6 text-lg">
                <Link href="tel:256-274-8530">Call (256) 274-8530</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Reward Tiers Section */}
        <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Tiered Reward Structure
              </h2>
              <p className="text-xl text-neutral-300 max-w-2xl mx-auto">
                The more you refer, the bigger your rewards!
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-5xl mx-auto mb-12">
              {rewardTiers.map((tier, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg p-6 text-center transition-all ${
                    tier.amount === '$1,000'
                      ? 'bg-gradient-to-b from-brand-green/30 to-brand-green/10 border-2 border-brand-green'
                      : 'bg-neutral-800 border border-neutral-700 hover:border-brand-green'
                  }`}
                >
                  <p className="text-sm font-semibold mb-2 text-neutral-400">
                    {tier.referral} Referral
                  </p>
                  <p className={`text-3xl md:text-4xl font-black ${tier.amount === '$1,000' ? 'text-brand-green' : 'text-white'}`}>
                    {tier.amount}
                  </p>
                </div>
              ))}
            </div>

            <div className="max-w-3xl mx-auto bg-gradient-to-r from-brand-green/20 to-lime-500/20 border border-brand-green/40 rounded-lg p-8 text-center">
              <DollarSign className="text-brand-green mx-auto mb-4" size={48} />
              <h3 className="text-2xl font-bold text-white mb-3">
                Earn Up To $7,850!
              </h3>
              <p className="text-neutral-300">
                Refer all 10 people and earn a total of <span className="text-white font-bold">$7,850</span> in rewards!
                <br /><span className="text-sm">Program limited to 10 referrals per customer.</span>
              </p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-12 md:py-16 bg-brand-blue/90 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                How It Works
              </h2>
              <p className="text-xl text-blue-100 max-w-2xl mx-auto">
                Three simple steps to start earning
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
                  desc: 'When they contact us and complete a roofing project, they receive the same great service you did.',
                },
                {
                  step: '3',
                  icon: DollarSign,
                  title: 'You Get Paid',
                  desc: 'Once their project is complete and paid, you receive your reward based on the tier structure!',
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

        {/* Calculator Section */}
        <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-xl mx-auto">
              <ReferralCalculator />
            </div>
          </div>
        </section>

        {/* Program Requirements */}
        <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
                Program Requirements
              </h2>

              <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-8">
                <h3 className="text-xl font-bold text-brand-green mb-4">Who Can Participate:</h3>
                <ul className="space-y-4 text-neutral-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span><strong className="text-white">Previous customers only</strong> - You must have a completed contract with River City Roofing Solutions</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span>Your referral must mention your name when they contact us</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span>Applies to residential and commercial roofing projects</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span><strong className="text-white">Reward paid when the referred job is completed</strong> and payment is received</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span><strong className="text-white">Maximum of 10 referrals per customer</strong> - earn up to $7,850 total!</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 grid md:grid-cols-2 gap-6">
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-6">
                  <h4 className="text-lg font-bold text-white mb-3">Example: 5 Referrals</h4>
                  <ul className="space-y-2 text-sm text-neutral-300">
                    <li>1st Referral: <span className="text-brand-green">$100</span></li>
                    <li>2nd Referral: <span className="text-brand-green">$250</span></li>
                    <li>3rd Referral: <span className="text-brand-green">$500</span></li>
                    <li>4th Referral: <span className="text-brand-green">$1,000</span></li>
                    <li>5th Referral: <span className="text-brand-green">$1,000</span></li>
                    <li className="border-t border-neutral-600 pt-2 mt-2">
                      <strong className="text-white">Total: $2,850</strong>
                    </li>
                  </ul>
                </div>
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-6">
                  <h4 className="text-lg font-bold text-white mb-3">Example: 10 Referrals</h4>
                  <ul className="space-y-2 text-sm text-neutral-300">
                    <li>1st-3rd: <span className="text-brand-green">$850</span></li>
                    <li>4th-10th: <span className="text-brand-green">$7,000</span> ($1k each)</li>
                    <li className="border-t border-neutral-600 pt-2 mt-2">
                      <strong className="text-white">Total: $7,850</strong>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Submit Referral Form Section */}
        <section id="submit" className="py-12 md:py-16 bg-brand-blue/90 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto">
              <ReferralForm />
            </div>
          </div>
        </section>

        {/* Contact CTA Section */}
        <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Prefer to Call or Email?
              </h2>
              <p className="text-lg text-neutral-300 mb-8 max-w-2xl mx-auto">
                You can also submit referrals by phone or email. Just provide the referral's name, phone, and address.
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
                  <a href="mailto:rcs@rivercityroofingsolutions.com" className="text-lg font-bold text-white hover:text-brand-green transition-colors">
                    rcs@rivercityroofingsolutions.com
                  </a>
                </div>
              </div>

              <p className="text-neutral-400 text-sm">
                Thank you for being a valued River City Roofing customer!
              </p>
            </div>
          </div>
        </section>

        {/* Terms & Conditions Section */}
        <section id="terms" className="py-12 md:py-16 bg-neutral-900/90 backdrop-blur-sm relative z-10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-center gap-3 mb-8">
                <FileText className="text-brand-green" size={32} />
                <h2 className="text-3xl md:text-4xl font-bold text-white">
                  Terms & Conditions
                </h2>
              </div>

              <div className="bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden">
                {/* Section 1: Eligibility */}
                <div className="p-6 border-b border-neutral-700">
                  <h3 className="text-lg font-bold text-brand-green mb-3">1. Eligibility</h3>
                  <ul className="space-y-2 text-neutral-300 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>The Program is open to past and current River City Roofing Solutions customers.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Participants must be 18 years or older.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Employees, sales reps, and contractors of River City Roofing may be eligible under separate internal rules.</span>
                    </li>
                  </ul>
                </div>

                {/* Section 2: What Counts as a Qualified Referral */}
                <div className="p-6 border-b border-neutral-700">
                  <h3 className="text-lg font-bold text-brand-green mb-3">2. What Counts as a Qualified Referral</h3>
                  <p className="text-neutral-400 text-sm mb-3">A referral qualifies only when ALL the following conditions are met:</p>
                  <ul className="space-y-2 text-neutral-300 text-sm mb-4">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Participant submits the homeowner's name and property address <strong className="text-white">before</strong> River City Roofing has made prior contact.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>River City Roofing completes a <strong className="text-white">full roof replacement</strong> for the referred homeowner.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>The project is finished according to River City Roofing processes and the account is settled in full.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>The referred job is located within River City Roofing's service area.</span>
                    </li>
                  </ul>
                  <p className="text-neutral-400 text-sm mb-2 font-semibold">NOT considered qualified:</p>
                  <ul className="space-y-2 text-neutral-400 text-sm">
                    <li className="flex items-start gap-2">
                      <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                      <span>Repairs, small jobs, tune-ups, or partial roof work</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                      <span>Duplicate referrals already in our system</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                      <span>Commercial projects (unless pre-approved)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                      <span>Self-referrals for the same household</span>
                    </li>
                  </ul>
                </div>

                {/* Section 3: Referral Reward Structure */}
                <div className="p-6 border-b border-neutral-700">
                  <h3 className="text-lg font-bold text-brand-green mb-3">3. Referral Reward Structure</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                    <div className="bg-neutral-700/50 rounded p-3 text-center">
                      <p className="text-neutral-400">Referral #1</p>
                      <p className="text-white font-bold">$100</p>
                    </div>
                    <div className="bg-neutral-700/50 rounded p-3 text-center">
                      <p className="text-neutral-400">Referral #2</p>
                      <p className="text-white font-bold">$250</p>
                    </div>
                    <div className="bg-neutral-700/50 rounded p-3 text-center">
                      <p className="text-neutral-400">Referral #3</p>
                      <p className="text-white font-bold">$500</p>
                    </div>
                    <div className="bg-brand-green/20 border border-brand-green/40 rounded p-3 text-center">
                      <p className="text-neutral-300">Referral #4+</p>
                      <p className="text-brand-green font-bold">$1,000 each</p>
                    </div>
                  </div>
                  <p className="text-neutral-400 text-sm">Rewards are paid per completed qualifying project and cannot be combined. Maximum of 10 referrals per customer.</p>
                </div>

                {/* Section 4: Payment */}
                <div className="p-6 border-b border-neutral-700">
                  <h3 className="text-lg font-bold text-brand-green mb-3">4. Payment</h3>
                  <ul className="space-y-2 text-neutral-300 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Rewards are issued after the referred roof is completed and the project is paid in full.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Payments may be made by check, digital transfer, or other approved method.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Please allow 2-6 weeks for processing after project completion.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Participant is responsible for any applicable taxes.</span>
                    </li>
                  </ul>
                </div>

                {/* Section 5: Submission Requirements */}
                <div className="p-6 border-b border-neutral-700">
                  <h3 className="text-lg font-bold text-brand-green mb-3">5. Submission Requirements</h3>
                  <p className="text-neutral-300 text-sm mb-3">A referral must be submitted through one of the following methods:</p>
                  <ul className="space-y-2 text-neutral-300 text-sm mb-3">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Text message, phone call, or email</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Website referral/contact form</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Submitted directly to a River City Roofing representative</span>
                    </li>
                  </ul>
                  <p className="text-yellow-500 text-sm flex items-start gap-2">
                    <AlertCircle className="flex-shrink-0 mt-0.5" size={16} />
                    <span>The referral must be received <strong>before</strong> any inspection or contact is made with the homeowner by River City Roofing staff.</span>
                  </p>
                </div>

                {/* Section 6: Verification & Fraud Prevention */}
                <div className="p-6 border-b border-neutral-700">
                  <h3 className="text-lg font-bold text-brand-green mb-3">6. Verification & Fraud Prevention</h3>
                  <p className="text-neutral-300 text-sm mb-3">River City Roofing reserves the right to:</p>
                  <ul className="space-y-2 text-neutral-300 text-sm mb-4">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Contact the referred homeowner to confirm the legitimacy of the referral</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Disqualify any referral suspected to be fraudulent, misleading, or intentionally manipulated</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Remove participants who attempt to abuse the Program</span>
                    </li>
                  </ul>
                  <p className="text-neutral-400 text-sm mb-2">Examples of disqualified referrals include:</p>
                  <ul className="space-y-1 text-neutral-400 text-sm">
                    <li className="flex items-start gap-2">
                      <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                      <span>Paying or coaching homeowners to pretend they were referred</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                      <span>Submitting random addresses without permission</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                      <span>Fake or incomplete contact info</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                      <span>Attempting to claim unknown incoming leads as "referrals"</span>
                    </li>
                  </ul>
                </div>

                {/* Section 7: Program Changes */}
                <div className="p-6 border-b border-neutral-700">
                  <h3 className="text-lg font-bold text-brand-green mb-3">7. Program Changes</h3>
                  <ul className="space-y-2 text-neutral-300 text-sm">
                    <li className="flex items-start gap-2">
                      <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={16} />
                      <span>River City Roofing Solutions may modify, pause, or terminate the Program at any time without prior notice.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Any eligible referrals submitted before cancellation will still be honored.</span>
                    </li>
                  </ul>
                </div>

                {/* Section 8: Legal */}
                <div className="p-6">
                  <h3 className="text-lg font-bold text-brand-green mb-3">8. Legal</h3>
                  <ul className="space-y-2 text-neutral-300 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Program is valid only in areas where River City Roofing Solutions operates.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Offer void where prohibited.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                      <span>Participation constitutes acceptance of these Terms & Conditions.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="mt-8 p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg">
                <p className="text-neutral-400 text-xs text-center leading-relaxed">
                  Referral reward paid after referred project is completed and account is settled. Only valid for full roof replacements.
                  Referral must be submitted prior to inspection or contact. River City Roofing Solutions reserves the right to modify
                  or cancel the program at any time. Void where prohibited.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
