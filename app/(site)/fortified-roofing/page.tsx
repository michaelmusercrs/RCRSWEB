import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Shield,
  CheckCircle2,
  Phone,
  ArrowRight,
  DollarSign,
  Award,
  Home,
  Zap,
  CloudLightning,
  HardHat,
  ClipboardCheck,
  FileCheck,
  Hammer,
  BadgeCheck,
} from 'lucide-react';
import { generateMetadata as genMeta, generateBreadcrumbSchema, generateFAQSchema, generateServiceSchema, siteConfig } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';
import type { Metadata } from 'next';

export const metadata: Metadata = genMeta({
  title: 'FORTIFIED Roofing in Alabama | Up to $10,000 in Grants & Insurance Discounts',
  description: 'FORTIFIED roofing in North Alabama. IBHS-certified storm-resistant roof upgrades with up to $10,000 in Strengthen Alabama Homes grants and 25-55% insurance premium discounts. Free consultation from River City Roofing Solutions.',
  path: '/fortified-roofing',
  keywords: [
    'fortified roofing alabama',
    'fortified roof',
    'FORTIFIED home program',
    'strengthen alabama homes grant',
    'fortified roof insurance discount',
    'IBHS fortified',
    'fortified roof cost alabama',
    'fortified roofing contractor huntsville',
    'fortified roofing contractor decatur',
    'fortified roof grant alabama',
    'wind resistant roof alabama',
    'storm resistant roof north alabama',
    'fortified roof designation',
    'fortified gold roof alabama',
    'fortified silver roof',
    'fortified bronze roof',
    'fortified evaluator alabama',
    'hail resistant roof alabama',
  ],
});

const fortifiedTiers = [
  {
    tier: 'FORTIFIED Roof',
    altName: 'Bronze',
    focus: 'Roof System',
    requirements: [
      'Sealed roof deck (taped seams or adhered membrane)',
      'Ring-shank nails (8d, 0.113" diameter minimum)',
      'Enhanced drip edge (26-gauge minimum metal)',
      'Proper attic ventilation',
      'Code-plus underlayment system',
      'Impact-resistant shingles (recommended)',
    ],
    protection: 'Protects against wind-driven rain, moderate hail, and high winds up to 130 mph',
    insuranceDiscount: '25-35%',
    idealFor: 'Homeowners wanting essential storm protection and immediate insurance savings',
    color: 'brand-green',
  },
  {
    tier: 'FORTIFIED Silver',
    altName: 'Silver',
    focus: 'Roof + Openings',
    requirements: [
      'All FORTIFIED Roof requirements',
      'Impact-resistant windows or storm shutters',
      'Reinforced entry doors',
      'Impact-rated garage doors',
      'Sealed building envelope openings',
      'Protected gable end walls',
    ],
    protection: 'Protects against wind-borne debris, flying objects, and severe storm penetration',
    insuranceDiscount: '35-45%',
    idealFor: 'Homeowners in high-wind or tornado-prone areas wanting comprehensive protection',
    color: 'blue-400',
  },
  {
    tier: 'FORTIFIED Gold',
    altName: 'Gold',
    focus: 'Roof + Openings + Structure',
    requirements: [
      'All FORTIFIED Roof and Silver requirements',
      'Continuous load path (roof-to-wall-to-foundation)',
      'Hurricane straps or clips at every connection',
      'Reinforced wall-to-foundation anchoring',
      'Engineered bracing for gable end walls',
      'Complete structural wind resistance system',
    ],
    protection: 'Maximum protection: withstands major hurricanes, EF2+ tornadoes, and extreme wind events',
    insuranceDiscount: '45-55%',
    idealFor: 'Maximum protection and largest insurance savings; best for new construction or major renovations',
    color: 'yellow-400',
  },
];

const processSteps = [
  {
    step: 1,
    icon: ClipboardCheck,
    title: 'Free FORTIFIED Consultation',
    desc: 'We assess your current roof and home to determine the best FORTIFIED designation path for your property, budget, and goals.',
  },
  {
    step: 2,
    icon: FileCheck,
    title: 'FORTIFIED Evaluation',
    desc: 'A certified FORTIFIED Evaluator inspects your home and documents exactly what upgrades are needed to meet the FORTIFIED standard.',
  },
  {
    step: 3,
    icon: Hammer,
    title: 'Installation & Upgrades',
    desc: 'Our trained crew installs your FORTIFIED-compliant roof system using IBHS-approved materials, techniques, and nailing patterns.',
  },
  {
    step: 4,
    icon: BadgeCheck,
    title: 'Certification & Designation',
    desc: 'The evaluator verifies all work, submits documentation to IBHS, and you receive your official FORTIFIED designation certificate.',
  },
];

const faqs = [
  {
    question: 'How much does a FORTIFIED roof cost compared to a standard roof?',
    answer: 'A FORTIFIED Roof designation typically adds 5-10% to the cost of a standard roof replacement. However, the insurance premium savings often pay for the difference within 2-4 years, making it a net-positive investment. The Strengthen Alabama Homes grant can cover up to $10,000 of the cost for eligible homeowners.',
  },
  {
    question: 'Is my home in North Alabama eligible for the Strengthen Alabama Homes grant?',
    answer: 'The Strengthen Alabama Homes program has been expanding its eligible counties over time. As of early 2026, grants have been offered in Mobile, Baldwin, Jefferson, Tuscaloosa, and Escambia counties, with the program continuing to add new counties. Check strengthenalabamahomes.com for the latest application schedule, as North Alabama counties may be added in future grant rounds.',
  },
  {
    question: 'How long does a FORTIFIED designation last?',
    answer: 'A FORTIFIED Roof designation is valid for 5 years from the date of certification. After 5 years, you can have the roof re-evaluated and re-designated. Keeping your designation current ensures you continue to receive insurance discounts.',
  },
  {
    question: 'Do all insurance companies in Alabama offer FORTIFIED discounts?',
    answer: 'Alabama is the only state with regulated minimum discounts for FORTIFIED construction. All insurers offering wind coverage in Alabama are required to provide discounts for FORTIFIED-designated homes. The specific discount percentage varies by carrier and tier, but typical savings range from 25% to 55% on the wind portion of your premium.',
  },
  {
    question: 'Can I get a FORTIFIED designation on my existing roof without replacing it?',
    answer: 'In some cases, yes. If your existing roof is in good condition and meets certain baseline requirements, a FORTIFIED Evaluator can assess whether targeted upgrades (like adding a sealed roof deck during a re-roof, or improving attic ventilation) can bring it to FORTIFIED standards. However, most homes achieve FORTIFIED designation during a full roof replacement, which is the most cost-effective approach.',
  },
];

export default function FortifiedRoofingPage() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'FORTIFIED Roofing', url: '/fortified-roofing' },
  ]);

  const serviceSchema = generateServiceSchema({
    name: 'FORTIFIED Roofing Installation & Certification',
    description: 'IBHS FORTIFIED roof installation and certification services in North Alabama. Storm-resistant roofing upgrades with insurance discount qualification and grant assistance.',
    url: `${siteConfig.url}/fortified-roofing`,
  });

  const faqSchema = generateFAQSchema(faqs);

  return (
    <div className="min-h-screen">
      <StructuredData data={[serviceSchema, breadcrumbSchema, faqSchema]} />

      {/* Hero Section */}
      <section className="min-h-[60vh] flex items-center justify-center relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 z-0" />
        <div className="container mx-auto px-4 text-center text-white relative z-10">
          <div className="inline-flex items-center gap-2 bg-brand-green/10 border border-brand-green/30 rounded-full px-5 py-2 mb-6">
            <Shield size={18} className="text-brand-green" />
            <span className="text-brand-green text-sm font-semibold">IBHS Certified Program</span>
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 drop-shadow-lg max-w-5xl mx-auto leading-tight">
            FORTIFIED Roofing in North Alabama
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md mb-4">
            Stronger Roofs. Lower Insurance. Up to $10,000 in Grants.
          </p>
          <p className="text-lg text-white/70 max-w-2xl mx-auto mb-8">
            Protect your home from tornadoes, hail, and severe storms with an IBHS FORTIFIED-rated roof
            and save 25-55% on your insurance premiums.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild className="bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-6 text-lg">
              <Link href="/contact">Free FORTIFIED Consultation</Link>
            </Button>
            <Button asChild className="border-2 border-white text-white hover:bg-white hover:text-black font-bold px-8 py-6 text-lg">
              <Link href="tel:256-274-8530">
                <Phone size={18} className="mr-2" />
                (256) 274-8530
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* What is FORTIFIED? */}
      <section className="py-16 md:py-20 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                  What Is FORTIFIED Roofing?
                </h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  FORTIFIED is a voluntary construction and re-roofing program developed by the{' '}
                  <strong className="text-white">Insurance Institute for Business &amp; Home Safety (IBHS)</strong>.
                  It sets standards that go beyond minimum building codes to provide real, tested protection
                  against severe weather including high winds, hail, hurricanes, and tornadoes.
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  The program uses an incremental approach with three designation levels, so homeowners
                  can strengthen their homes in manageable steps. Each level addresses the most common
                  failure points first, then builds upon that foundation.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  Alabama is the <strong className="text-brand-green">only state in the nation</strong> with
                  regulated minimum insurance discounts for FORTIFIED construction, making it one of the
                  best investments a North Alabama homeowner can make.
                </p>
              </div>
              <div className="space-y-4">
                {[
                  { icon: Shield, label: 'Tested & Proven', desc: 'IBHS full-scale lab testing proves FORTIFIED homes survive storms that destroy standard construction' },
                  { icon: DollarSign, label: 'Insurance Savings', desc: 'Alabama law requires insurers to offer discounts of 25-55% on the wind portion of your premium' },
                  { icon: Award, label: 'Higher Home Value', desc: 'University of Alabama research shows FORTIFIED homes sell for nearly 7% more than non-FORTIFIED homes' },
                  { icon: Home, label: 'Peace of Mind', desc: 'Know your family and belongings are protected when the next severe storm hits North Alabama' },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div key={idx} className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-xl p-4 hover:border-brand-green/30 transition-colors">
                      <div className="bg-brand-green/20 rounded-lg p-2 flex-shrink-0">
                        <Icon className="text-brand-green" size={24} />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold mb-1">{item.label}</h3>
                        <p className="text-gray-400 text-sm">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Strengthen Alabama Homes Grants */}
      <section className="py-16 md:py-20 bg-brand-green/10 backdrop-blur-sm relative z-10 border-y border-brand-green/20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-brand-green/10 border border-brand-green/30 rounded-full px-4 py-2 mb-4">
                <DollarSign size={18} className="text-brand-green" />
                <span className="text-brand-green text-sm font-semibold">Alabama Grant Program</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
                Strengthen Alabama Homes: Up to $10,000 in Grants
              </h2>
              <p className="text-lg text-neutral-300 max-w-3xl mx-auto">
                The Strengthen Alabama Homes program, administered by the Alabama Department of Insurance,
                provides grants of up to $10,000 to help homeowners upgrade to a FORTIFIED-rated roof.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-10">
              <div className="bg-neutral-800/80 border border-neutral-700 rounded-xl p-8">
                <h3 className="text-2xl font-bold text-white mb-4">Eligibility Requirements</h3>
                <ul className="space-y-3">
                  {[
                    'Owner-occupied, single-family home (no townhomes, attached homes, or mobile homes)',
                    'Property must be your primary residence',
                    'Applicant must be named on the deed',
                    'Total household income below $85,687 (all residents combined)',
                    'Must have active homeowners insurance with wind and hail coverage',
                    'Home must be in an eligible county during an open application period',
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={18} />
                      <span className="text-gray-300 text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-neutral-800/80 border border-neutral-700 rounded-xl p-8">
                <h3 className="text-2xl font-bold text-white mb-4">How to Apply</h3>
                <ol className="space-y-4">
                  {[
                    { title: 'Create a profile', desc: 'Visit strengthenalabamahomes.com during an open application window for your county' },
                    { title: 'Submit documentation', desc: 'Upload income verification, insurance declarations page, and vendor disclosure form within 7 days' },
                    { title: 'Get evaluated', desc: 'Choose a certified FORTIFIED Evaluator to assess your home and document required upgrades' },
                    { title: 'Collect contractor bids', desc: 'Select three qualified contractors from the SAH list to provide bids for the work' },
                    { title: 'Receive grant award', desc: 'Once bids are reviewed, you receive a grant award letter and work can begin' },
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="bg-brand-green text-black font-bold text-sm w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="text-white font-semibold">{item.title}</span>
                        <p className="text-gray-400 text-sm mt-0.5">{item.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <Zap className="text-yellow-400 flex-shrink-0 mt-1" size={22} />
                <div>
                  <h4 className="text-yellow-400 font-bold mb-1">North Alabama Homeowners: Important Note</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    The Strengthen Alabama Homes program has been expanding to new counties each year. As of early 2026,
                    grants have been offered in Mobile, Baldwin, Jefferson, Tuscaloosa, and Escambia counties.
                    North Alabama counties (Madison, Morgan, Limestone, etc.) have not yet been included, but
                    the program continues to grow. We recommend{' '}
                    <a
                      href="https://www.strengthenalabamahomes.com/Home/GrantSchedule"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-green hover:text-lime-400 underline"
                    >
                      checking the grant schedule
                    </a>{' '}
                    regularly for updates. Even without the grant, FORTIFIED upgrades pay for themselves through
                    insurance savings and increased home value.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Insurance Savings */}
      <section className="py-16 md:py-20 bg-black/70 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
                Insurance Savings That Add Up Fast
              </h2>
              <p className="text-lg text-neutral-300 max-w-3xl mx-auto">
                Alabama requires all insurers to offer discounts on the wind portion of your homeowners
                premium for FORTIFIED-designated homes. These savings are significant and ongoing.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-10">
              {[
                {
                  tier: 'FORTIFIED Roof',
                  discount: '25-35%',
                  example: '$600 - $840',
                  desc: 'Annual savings on a $2,400 premium',
                  color: 'brand-green',
                },
                {
                  tier: 'FORTIFIED Silver',
                  discount: '35-45%',
                  example: '$840 - $1,080',
                  desc: 'Annual savings on a $2,400 premium',
                  color: 'blue-400',
                },
                {
                  tier: 'FORTIFIED Gold',
                  discount: '45-55%',
                  example: '$1,080 - $1,320',
                  desc: 'Annual savings on a $2,400 premium',
                  color: 'yellow-400',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="bg-neutral-800 border border-neutral-700 rounded-xl p-8 text-center hover:border-brand-green/50 transition-all"
                >
                  <div className="text-neutral-400 text-sm mb-2 uppercase tracking-wide">{item.tier}</div>
                  <div className={`text-5xl font-bold mb-2 ${
                    item.color === 'brand-green' ? 'text-brand-green' :
                    item.color === 'blue-400' ? 'text-blue-400' :
                    'text-yellow-400'
                  }`}>
                    {item.discount}
                  </div>
                  <div className="text-neutral-400 text-sm mb-4">off wind premium</div>
                  <div className="border-t border-neutral-700 pt-4">
                    <div className="text-2xl font-bold text-white">{item.example}</div>
                    <div className="text-neutral-500 text-xs mt-1">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-8">
              <h3 className="text-xl font-bold text-white mb-4 text-center">10-Year Savings Example</h3>
              <div className="grid md:grid-cols-4 gap-6 text-center">
                {[
                  { label: 'Annual Premium', value: '$2,400', sub: 'Typical Alabama homeowner' },
                  { label: 'FORTIFIED Roof Savings', value: '$7,200+', sub: '~$720/year over 10 years' },
                  { label: 'Home Value Increase', value: '~7%', sub: 'Per University of Alabama study' },
                  { label: 'Grant Available', value: 'Up to $10,000', sub: 'In eligible counties' },
                ].map((item, idx) => (
                  <div key={idx}>
                    <div className="text-neutral-400 text-xs uppercase tracking-wide mb-1">{item.label}</div>
                    <div className="text-2xl font-bold text-brand-green">{item.value}</div>
                    <div className="text-neutral-500 text-xs mt-1">{item.sub}</div>
                  </div>
                ))}
              </div>
              <p className="text-neutral-500 text-xs text-center mt-6">
                * Savings estimates are based on typical Alabama homeowners insurance premiums and FORTIFIED Roof designation.
                Actual discounts vary by carrier, coverage, and location. Consult your insurance provider for exact figures.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FORTIFIED Tier Comparison */}
      <section className="py-16 md:py-20 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
                FORTIFIED Roof vs. Silver vs. Gold
              </h2>
              <p className="text-lg text-neutral-300 max-w-3xl mx-auto">
                Each FORTIFIED level builds on the previous one, giving you increasing protection and
                bigger insurance discounts. Most homeowners start with FORTIFIED Roof.
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {fortifiedTiers.map((tier, idx) => (
                <div
                  key={idx}
                  className={`bg-neutral-800/80 border rounded-xl p-8 transition-all hover:scale-[1.02] ${
                    idx === 0 ? 'border-brand-green/50 ring-1 ring-brand-green/20' :
                    idx === 1 ? 'border-blue-400/50' :
                    'border-yellow-400/50'
                  }`}
                >
                  {idx === 0 && (
                    <div className="text-xs font-bold text-brand-green uppercase tracking-wider mb-3">
                      Most Popular
                    </div>
                  )}
                  <h3 className={`text-2xl font-bold mb-1 ${
                    idx === 0 ? 'text-brand-green' :
                    idx === 1 ? 'text-blue-400' :
                    'text-yellow-400'
                  }`}>
                    {tier.tier}
                  </h3>
                  <p className="text-neutral-400 text-sm mb-4">Focus: {tier.focus}</p>

                  <div className={`text-3xl font-bold mb-1 ${
                    idx === 0 ? 'text-brand-green' :
                    idx === 1 ? 'text-blue-400' :
                    'text-yellow-400'
                  }`}>
                    {tier.insuranceDiscount}
                  </div>
                  <p className="text-neutral-500 text-xs mb-6">Insurance discount on wind premium</p>

                  <div className="border-t border-neutral-700 pt-4 mb-4">
                    <h4 className="text-white font-semibold text-sm mb-3">Requirements:</h4>
                    <ul className="space-y-2">
                      {tier.requirements.map((req, rIdx) => (
                        <li key={rIdx} className="flex items-start gap-2">
                          <CheckCircle2 className={`flex-shrink-0 mt-0.5 ${
                            idx === 0 ? 'text-brand-green' :
                            idx === 1 ? 'text-blue-400' :
                            'text-yellow-400'
                          }`} size={14} />
                          <span className="text-gray-400 text-sm">{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-t border-neutral-700 pt-4 mb-4">
                    <h4 className="text-white font-semibold text-sm mb-2">Protection:</h4>
                    <p className="text-gray-400 text-sm">{tier.protection}</p>
                  </div>

                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-gray-300 text-xs italic">{tier.idealFor}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why FORTIFIED Matters in North Alabama */}
      <section className="py-16 md:py-20 bg-black/70 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
                Why FORTIFIED Matters in North Alabama
              </h2>
              <p className="text-lg text-neutral-300 max-w-3xl mx-auto">
                North Alabama sits in one of the most active severe weather corridors in the United States.
                FORTIFIED construction is not just smart here -- it is essential.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: CloudLightning,
                  title: 'Tornado Alley',
                  desc: 'North Alabama averages more than 30 tornado warnings per year. The 2011 Super Outbreak produced EF4 and EF5 tornadoes that devastated communities across the Tennessee Valley.',
                },
                {
                  icon: Zap,
                  title: 'Severe Hail Risk',
                  desc: 'Large hail events frequently strike Huntsville, Decatur, Athens, and surrounding areas. Standard roofs often sustain damage from hail as small as 1 inch in diameter.',
                },
                {
                  icon: Shield,
                  title: 'Straight-Line Winds',
                  desc: 'Derecho events and severe thunderstorm wind gusts regularly exceed 70-80 mph across North Alabama, enough to tear off standard roofing materials.',
                },
                {
                  icon: DollarSign,
                  title: 'Rising Insurance Costs',
                  desc: 'Alabama homeowners insurance premiums have been climbing steadily. FORTIFIED discounts are one of the few ways to meaningfully reduce what you pay each year.',
                },
                {
                  icon: Home,
                  title: 'Protect Your Investment',
                  desc: 'Your home is likely your largest asset. A FORTIFIED roof protects the entire structure by preventing the water intrusion that causes the majority of storm damage costs.',
                },
                {
                  icon: Award,
                  title: 'Proven Performance',
                  desc: 'After Hurricane Sally (2020), IBHS found that FORTIFIED homes suffered significantly less damage than standard-built homes in the same neighborhoods.',
                },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-brand-green/30 transition-colors">
                    <div className="bg-brand-green/20 rounded-lg p-3 w-fit mb-4">
                      <Icon className="text-brand-green" size={28} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Our FORTIFIED Installation Process */}
      <section className="py-16 md:py-20 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
                Our FORTIFIED Installation Process
              </h2>
              <p className="text-lg text-neutral-300 max-w-3xl mx-auto">
                River City Roofing Solutions handles every step of the FORTIFIED upgrade process, from
                initial consultation to final IBHS certification.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {processSteps.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.step} className="text-center">
                    <div className="w-16 h-16 bg-brand-green rounded-full flex items-center justify-center mx-auto mb-4 text-black text-2xl font-bold">
                      {s.step}
                    </div>
                    <div className="bg-brand-green/10 rounded-full p-2 w-fit mx-auto mb-3">
                      <Icon className="text-brand-green" size={20} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{s.title}</h3>
                    <p className="text-neutral-400 text-sm">{s.desc}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 bg-white/5 border border-white/10 rounded-xl p-8">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-4">What Sets Us Apart</h3>
                  <ul className="space-y-3">
                    {[
                      'IKO ROOFPRO Craftsman Premier & Owens Corning Preferred Contractor',
                      'Trained in IBHS FORTIFIED installation standards',
                      'We coordinate with certified FORTIFIED Evaluators',
                      'Full documentation for insurance discount qualification',
                      'Grant application assistance for eligible homeowners',
                      'Serving Decatur, Huntsville, Madison, Athens & all of North Alabama',
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={18} />
                        <span className="text-gray-300 text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-8 text-center">
                  <HardHat className="text-brand-green mx-auto mb-4" size={48} />
                  <div className="text-3xl font-bold text-white mb-2">Free Consultation</div>
                  <p className="text-neutral-400 text-sm mb-6">
                    Find out if FORTIFIED is right for your home. No cost, no obligation.
                  </p>
                  <Button asChild className="w-full bg-brand-green hover:bg-lime-400 text-black font-bold py-4 text-lg">
                    <Link href="/contact">Schedule Now</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-20 bg-black/70 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
              FORTIFIED Roofing FAQ
            </h2>
            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <details
                  key={idx}
                  className="group bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden hover:border-brand-green/50 transition-all"
                >
                  <summary className="flex items-center justify-between cursor-pointer p-5 text-white font-semibold list-none">
                    <span className="pr-4">{faq.question}</span>
                    <ArrowRight size={18} className="text-neutral-400 group-open:rotate-90 transition-transform flex-shrink-0" />
                  </summary>
                  <div className="px-5 pb-5">
                    <p className="text-neutral-300 leading-relaxed">{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
            <div className="text-center mt-6">
              <Link href="/faq" className="text-brand-green hover:text-lime-400 font-medium transition-colors">
                View All Frequently Asked Questions &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Internal Links */}
      <section className="py-12 bg-black/80 backdrop-blur-sm relative z-10 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-brand-green mb-3">Related Services</h3>
                <ul className="space-y-2">
                  <li><Link href="/services/residential-roof-replacement" className="text-gray-300 hover:text-brand-green transition-colors">Residential Roof Replacement</Link></li>
                  <li><Link href="/services/storm-hail-damage-repair" className="text-gray-300 hover:text-brand-green transition-colors">Storm &amp; Hail Damage Repair</Link></li>
                  <li><Link href="/services/roof-inspections-maintenance" className="text-gray-300 hover:text-brand-green transition-colors">Roof Inspections &amp; Maintenance</Link></li>
                  <li><Link href="/services/attic-ventilation" className="text-gray-300 hover:text-brand-green transition-colors">Attic Ventilation</Link></li>
                  <li><Link href="/financing" className="text-gray-300 hover:text-brand-green transition-colors">Roof Financing Options</Link></li>
                  <li><Link href="/services" className="text-brand-green font-semibold hover:text-lime-400 transition-colors">View All Services &rarr;</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-brand-green mb-3">FORTIFIED Resources</h3>
                <ul className="space-y-2">
                  <li>
                    <a href="https://fortifiedhome.org/" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-brand-green transition-colors">
                      FORTIFIED Home (Official IBHS Site) &nearr;
                    </a>
                  </li>
                  <li>
                    <a href="https://www.strengthenalabamahomes.com/" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-brand-green transition-colors">
                      Strengthen Alabama Homes &nearr;
                    </a>
                  </li>
                  <li>
                    <a href="https://www.strengthenalabamahomes.com/Home/GrantSchedule" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-brand-green transition-colors">
                      Grant Application Schedule &nearr;
                    </a>
                  </li>
                  <li>
                    <a href="https://fortifiedhome.org/incentives/" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-brand-green transition-colors">
                      FORTIFIED Financial Incentives &nearr;
                    </a>
                  </li>
                  <li><Link href="/check-my-address" className="text-gray-300 hover:text-brand-green transition-colors">Check Your Address for Storm Activity</Link></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 bg-brand-blue relative z-10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Ready for a Stronger Roof and Lower Insurance?
          </h2>
          <p className="text-xl text-blue-50 mb-4 max-w-3xl mx-auto">
            Contact River City Roofing Solutions today for a free FORTIFIED consultation. We will
            assess your home, explain your options, and help you maximize your savings.
          </p>
          <p className="text-blue-200 mb-8">
            Serving Decatur, Huntsville, Madison, Athens, and all of North Alabama.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 bg-brand-green text-black font-bold px-8 py-4 rounded-full hover:bg-lime-400 transition-colors"
            >
              Get Free FORTIFIED Consultation <ArrowRight size={20} />
            </Link>
            <a
              href="tel:256-274-8530"
              className="inline-flex items-center justify-center gap-2 bg-white text-brand-blue font-bold px-8 py-4 rounded-full hover:bg-gray-100 transition-colors"
            >
              <Phone size={20} /> (256) 274-8530
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
