import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Shield,
  Star,
  Award,
  Users,
  FileText,
  Heart,
  Smartphone,
  Handshake,
  Phone,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { generateMetadata as genMeta, generateBreadcrumbSchema, siteConfig } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';
import type { Metadata } from 'next';

export const metadata: Metadata = genMeta({
  title: 'Why Choose Us | Best Roofing Company Huntsville & Decatur AL',
  description:
    'See why Huntsville & Decatur homeowners choose River City Roofing Solutions. In-house crews, 5.0 rating, IKO ROOFPRO Craftsman Premier certified, full warranties on all work, and zero-pressure estimates. Family-owned since 2010.',
  path: '/why-choose-us',
  keywords: [
    'best roofing company huntsville al',
    'why choose river city roofing',
    'top rated roofer decatur al',
    'best roofer north alabama',
    'trusted roofing contractor huntsville',
    'family owned roofer alabama',
    'no subcontractor roofing company',
    'five star roofing company huntsville',
    '5.0 rated roofer decatur al',
    'IKO ROOFPRO contractor huntsville',
    'insurance claim roofer alabama',
    'roof replacement huntsville al',
  ],
});

const reasons = [
  {
    icon: Users,
    title: 'Our Own Crews - Never Subcontracted',
    description:
      'We never subcontract. Every project is completed by our trained, in-house team. You\u2019ll know exactly who\u2019s on your roof, and they answer directly to us. No middlemen, no strangers, no surprises.',
    highlight: '100% in-house installation teams',
  },
  {
    icon: Shield,
    title: 'We Guarantee Everything',
    description:
      'Full warranty on ALL work - replacements AND repairs. No exceptions, no fine print, no excuses. Our 5-year workmanship warranty covers every nail, every flashing, every detail. If something goes wrong with our work, we fix it. Period.',
    highlight: '5-year workmanship warranty on every project',
  },
  {
    icon: Star,
    title: '270+ Five-Star Reviews',
    description:
      'Perfect 5.0 rating across Google, BBB, and Facebook. Not 4.8, not 4.5 - a genuine, verified 5.0 from over 270 homeowners. That kind of consistency doesn\u2019t happen by accident. It happens because we treat every roof like it\u2019s our own.',
    highlight: 'Perfect 5.0 across every platform',
  },
  {
    icon: Award,
    title: 'IKO ROOFPRO Craftsman Premier',
    description:
      'North Alabama\u2019s highest-certified IKO contractor. The Craftsman Premier designation is the top tier of IKO\u2019s contractor program, meaning we meet the industry\u2019s most rigorous standards for both materials and installation. Your roof gets the best of both.',
    highlight: 'Highest IKO certification in North Alabama',
  },
  {
    icon: FileText,
    title: 'Insurance Claims Experts',
    description:
      'We handle the paperwork. We meet with your adjuster on-site. We document every square inch of damage and fight for your full claim amount. You shouldn\u2019t have to become an insurance expert just because a storm hit your house.',
    highlight: 'Full claims support from start to finish',
  },
  {
    icon: Heart,
    title: 'Family-Owned, Not Corporate',
    description:
      'Chris and Michael Muse founded River City Roofing Solutions in 2010. When you call, you get family - not a call center, not a national franchise, not a revolving door of salespeople. Our reputation is personal because our name is on every roof.',
    highlight: 'Locally owned and operated since 2010',
  },
  {
    icon: Smartphone,
    title: 'Technology You Can See',
    description:
      'Track your project in real time through our customer portal. Check your address for storm history with our free tool. Get digital estimates, progress photos, and completion documentation. We\u2019re the most tech-forward roofer in North Alabama.',
    highlight: 'Customer portal, storm tools & digital tracking',
  },
  {
    icon: Handshake,
    title: 'No Pressure, Ever',
    description:
      'Free inspections with zero obligation. Written estimates upfront with no hidden fees. We earn your business with quality, transparency, and honest advice - not high-pressure tactics or scare tactics. If your roof doesn\u2019t need work, we\u2019ll tell you.',
    highlight: 'Free inspections with zero obligation',
  },
];

export default function WhyChooseUsPage() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Why Choose Us', url: '/why-choose-us' },
  ]);

  const pageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Why Choose River City Roofing Solutions',
    description:
      'Discover why Huntsville and Decatur homeowners trust River City Roofing Solutions for roof replacement, repair, and storm damage restoration.',
    url: `${siteConfig.url}/why-choose-us`,
    mainEntity: {
      '@type': 'RoofingContractor',
      '@id': `${siteConfig.url}#organization`,
      name: siteConfig.name,
      telephone: siteConfig.phone,
      address: {
        '@type': 'PostalAddress',
        ...siteConfig.address,
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ...siteConfig.reviewStats,
      },
      hasCredential: [
        {
          '@type': 'EducationalOccupationalCredential',
          credentialCategory: 'Professional Certification',
          name: 'IKO ROOFPRO Craftsman Premier',
        },
        {
          '@type': 'EducationalOccupationalCredential',
          credentialCategory: 'Professional Certification',
          name: 'Owens Corning Preferred Contractor',
        },
        {
          '@type': 'EducationalOccupationalCredential',
          credentialCategory: 'Professional Certification',
          name: 'Boral Certified LeafX Dealer / Pro Installer',
        },
      ],
    },
  };

  return (
    <div className="min-h-screen">
      <StructuredData data={[pageSchema, breadcrumbSchema]} />

      {/* Hero Section */}
      <section className="min-h-[50vh] flex items-center justify-center">
        <div className="container mx-auto px-4 text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
            Why Huntsville &amp; Decatur Homeowners Choose River City Roofing Solutions
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md">
            In-house crews. Perfect 5.0 rating. IKO&apos;s highest certification. Full warranties.
            Zero pressure. This is roofing done right.
          </p>
        </div>
      </section>

      {/* Quick Stats Bar */}
      <section className="py-8 bg-black/90 backdrop-blur-sm relative z-10 border-b border-brand-green/20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto text-center">
            <div>
              <p className="text-3xl md:text-4xl font-bold text-brand-green">5.0</p>
              <p className="text-neutral-400 text-sm mt-1">Star Rating</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-brand-green">270+</p>
              <p className="text-neutral-400 text-sm mt-1">Five-Star Reviews</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-brand-green">2010</p>
              <p className="text-neutral-400 text-sm mt-1">Established</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-brand-green">A+</p>
              <p className="text-neutral-400 text-sm mt-1">BBB Rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Reasons Section */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                8 Reasons We&apos;re Different
              </h2>
              <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
                Every roofing company says they&apos;re the best. Here&apos;s how we actually prove it.
              </p>
            </div>

            <div className="space-y-6">
              {reasons.map((reason, idx) => {
                const Icon = reason.icon;
                return (
                  <div
                    key={idx}
                    className="bg-neutral-800 border border-neutral-700 rounded-lg p-8 hover:border-brand-green/50 transition-all group"
                  >
                    <div className="flex flex-col md:flex-row md:items-start gap-6">
                      <div className="flex-shrink-0">
                        <div className="bg-brand-green rounded-full w-16 h-16 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Icon className="text-black" size={32} />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-brand-green transition-colors">
                          {reason.title}
                        </h3>
                        <p className="text-neutral-300 leading-relaxed text-lg mb-3">
                          {reason.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="text-brand-green flex-shrink-0" size={18} />
                          <span className="text-brand-green font-semibold text-sm">
                            {reason.highlight}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Certifications Bar */}
      <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Industry Certifications That Matter
              </h2>
              <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
                Not every roofer can earn these. They require proven track records, ongoing training,
                and strict quality standards.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 text-center hover:border-brand-green/50 transition-all">
                <Award className="text-brand-green mx-auto mb-3" size={40} />
                <h3 className="text-lg font-bold text-white mb-1">IKO ROOFPRO&reg;</h3>
                <p className="text-brand-green text-sm font-semibold mb-2">Craftsman Premier</p>
                <p className="text-neutral-400 text-sm">
                  The highest tier of IKO&apos;s contractor program. Top materials, top installation standards.
                </p>
              </div>
              <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 text-center hover:border-brand-green/50 transition-all">
                <Award className="text-brand-green mx-auto mb-3" size={40} />
                <h3 className="text-lg font-bold text-white mb-1">Owens Corning</h3>
                <p className="text-brand-green text-sm font-semibold mb-2">Preferred Contractor</p>
                <p className="text-neutral-400 text-sm">
                  Recognized for meeting rigorous standards in roofing excellence and customer satisfaction.
                </p>
              </div>
              <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 text-center hover:border-brand-green/50 transition-all">
                <Award className="text-brand-green mx-auto mb-3" size={40} />
                <h3 className="text-lg font-bold text-white mb-1">Boral Certified</h3>
                <p className="text-brand-green text-sm font-semibold mb-2">LeafX Dealer / Pro Installer</p>
                <p className="text-neutral-400 text-sm">
                  Authorized dealer and certified installer of Boral LeafX gutter protection systems.
                </p>
              </div>
              <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 text-center hover:border-brand-green/50 transition-all">
                <Shield className="text-brand-green mx-auto mb-3" size={40} />
                <h3 className="text-lg font-bold text-white mb-1">BBB A+ Rated</h3>
                <p className="text-brand-green text-sm font-semibold mb-2">Accredited Business</p>
                <p className="text-neutral-400 text-sm">
                  Better Business Bureau A+ rating with full accreditation. Zero unresolved complaints.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Testimonial Callout */}
      <section className="py-12 md:py-16 bg-brand-blue/90 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Star className="text-white mx-auto mb-4" size={48} />
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              What a 5.0 Rating Really Means
            </h2>
            <p className="text-xl text-blue-50 leading-relaxed mb-8 max-w-3xl mx-auto">
              It means every single customer - all 270+ of them - gave us a perfect score. It means
              we don&apos;t cut corners, we don&apos;t disappear after the job, and we don&apos;t make promises
              we can&apos;t keep. A 5.0 is earned one roof, one family, one handshake at a time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="bg-white text-brand-blue hover:bg-blue-50 font-bold px-8 py-6 text-lg">
                <Link href="/reviews">
                  Read Our Reviews
                  <ArrowRight size={18} className="ml-2" />
                </Link>
              </Button>
              <Button asChild className="border-2 border-white text-white hover:bg-white hover:text-brand-blue font-bold px-8 py-6 text-lg">
                <Link href="/check-my-address">Check Your Address</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Learn More Links */}
      <section className="py-8 bg-black/70 backdrop-blur-sm relative z-10 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-4 text-center">Explore More</h2>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { name: 'Our Services', href: '/services' },
                { name: 'Service Areas', href: '/service-areas' },
                { name: 'Customer Reviews', href: '/reviews' },
                { name: 'Project Gallery', href: '/gallery' },
                { name: 'About Us', href: '/about' },
                { name: 'FAQ', href: '/faq' },
                { name: 'Financing Options', href: '/financing' },
                { name: 'Warranty Info', href: '/warranty' },
                { name: 'Check My Address', href: '/check-my-address' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-full text-sm text-neutral-300 hover:text-brand-green hover:border-brand-green/50 transition-all font-medium"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto border-l-4 border-brand-green pl-8">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Ready for a Roofer You Can Trust?
            </h2>
            <p className="text-xl text-neutral-300 mb-8">
              Schedule your free, no-obligation inspection today. We&apos;ll give you an honest assessment
              and a written estimate - no pressure, no gimmicks. See for yourself why 270+ homeowners
              gave us a perfect 5.0.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild className="bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-6 text-lg">
                <Link href="/contact">Schedule Free Inspection</Link>
              </Button>
              <Button asChild className="border-2 border-white text-white hover:bg-white hover:text-black font-bold px-8 py-6 text-lg">
                <Link href="tel:256-274-8530">
                  <Phone size={18} className="mr-2" />
                  Call (256) 274-8530
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
