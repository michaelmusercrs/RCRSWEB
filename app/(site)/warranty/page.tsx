import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle2, XCircle, Award, Phone, FileText, Clock, ArrowRight } from 'lucide-react';
import { generateMetadata as genMeta, generateBreadcrumbSchema, siteConfig } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';
import type { Metadata } from 'next';

export const metadata: Metadata = genMeta({
  title: 'Roofing Warranty',
  description: 'Our 5-year workmanship warranty plus manufacturer warranties give you complete peace of mind. IKO certified contractor.',
  path: '/warranty',
  keywords: ['roofing warranty', 'roof warranty', 'workmanship warranty', 'IKO warranty', 'roofing guarantee', 'North Alabama roofer warranty'],
});

const covered = [
  'All labor and installation workmanship',
  'Flashing installation and sealing',
  'Ridge cap and vent installation',
  'Underlayment and ice/water shield installation',
  'Nail placement and fastening',
  'Pipe boot and penetration sealing',
  'Clean-up related issues (missed nails, debris)',
  'Drip edge and starter strip installation',
];

const notCovered = [
  'Acts of God (new storm damage, tornadoes, hurricanes)',
  'Normal wear and tear over time',
  'Damage caused by homeowner modifications',
  'Pre-existing conditions not addressed during installation',
  'Damage from improper maintenance (clogged gutters, etc.)',
  'Cosmetic differences due to weathering or aging',
];

const manufacturerWarranties = [
  {
    brand: 'IKO Dynasty',
    coverage: 'Limited Lifetime',
    windCoverage: 'Up to 130 mph',
    highlights: ['Lifetime limited shingle warranty', 'ArmourZone reinforced nailing area', 'Class 4 impact resistance available', 'Color fading protection'],
  },
  {
    brand: 'IKO Cambridge',
    coverage: 'Limited Lifetime',
    windCoverage: 'Up to 110 mph',
    highlights: ['Lifetime limited shingle warranty', 'Dual-layer construction', 'Wind resistance warranty', 'Algae resistance protection'],
  },
  {
    brand: 'GAF Timberline HDZ',
    coverage: 'Limited Lifetime',
    windCoverage: 'Up to 130 mph',
    highlights: ['Lifetime limited shingle warranty', 'LayerLock technology', 'StrikeZone nailing area', 'StainGuard Plus algae protection'],
  },
];

export default function WarrantyPage() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Warranty', url: '/warranty' },
  ]);

  const warrantySchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Roofing Warranty Information',
    description: 'Complete warranty details for River City Roofing Solutions including 5-year workmanship warranty and manufacturer warranties.',
    url: `${siteConfig.url}/warranty`,
    mainEntity: {
      '@type': 'RoofingContractor',
      '@id': `${siteConfig.url}#organization`,
      name: siteConfig.name,
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Warranty Programs',
        itemListElement: [
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: '5-Year Workmanship Warranty',
              description: 'Comprehensive coverage on all labor and installation for 5 years from completion date.',
            },
          },
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Manufacturer Warranty',
              description: 'Limited lifetime manufacturer warranties on shingle products from IKO and GAF.',
            },
          },
        ],
      },
    },
  };

  return (
    <div className="min-h-screen">
      <StructuredData data={[warrantySchema, breadcrumbSchema]} />

      {/* Hero Section */}
      <section className="min-h-[50vh] flex items-center justify-center">
        <div className="container mx-auto px-4 text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
            Our Warranty
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md">
            Complete peace of mind with our 5-year workmanship warranty and manufacturer-backed protection
          </p>
        </div>
      </section>

      {/* Warranty Overview */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-8">
                <div className="bg-brand-green rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Shield className="text-black" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">5-Year</h3>
                <p className="text-brand-green font-semibold text-lg mb-2">Workmanship Warranty</p>
                <p className="text-neutral-400 text-sm">
                  Full coverage on all labor and installation. If anything goes wrong with our work, we fix it free.
                </p>
              </div>
              <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-8">
                <div className="bg-brand-green rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Award className="text-black" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Lifetime</h3>
                <p className="text-brand-green font-semibold text-lg mb-2">Manufacturer Warranty</p>
                <p className="text-neutral-400 text-sm">
                  Limited lifetime warranties from IKO and GAF protect your shingles for decades to come.
                </p>
              </div>
              <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-8">
                <div className="bg-brand-green rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="text-black" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">IKO Certified</h3>
                <p className="text-brand-green font-semibold text-lg mb-2">Certified Contractor</p>
                <p className="text-neutral-400 text-sm">
                  As an IKO certified contractor, we meet the highest standards for installation quality.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workmanship Warranty Details */}
      <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                5-Year Workmanship Warranty
              </h2>
              <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
                Our workmanship warranty covers all aspects of the installation for 5 full years from the date of project completion.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Covered */}
              <div className="bg-neutral-800 border border-brand-green/30 rounded-lg p-8">
                <h3 className="text-2xl font-bold text-brand-green mb-6 flex items-center gap-3">
                  <CheckCircle2 size={24} />
                  What&apos;s Covered
                </h3>
                <ul className="space-y-3">
                  {covered.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={18} />
                      <span className="text-neutral-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Not Covered */}
              <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-8">
                <h3 className="text-2xl font-bold text-red-400 mb-6 flex items-center gap-3">
                  <XCircle size={24} />
                  What&apos;s Not Covered
                </h3>
                <ul className="space-y-3">
                  {notCovered.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <XCircle className="text-red-400/60 flex-shrink-0 mt-0.5" size={18} />
                      <span className="text-neutral-400">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-neutral-500 text-sm mt-6 border-t border-neutral-700 pt-4">
                  Note: New storm damage after installation is covered by your homeowner&apos;s insurance, and we will help you file that claim just as we did for the original project.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Manufacturer Warranties */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Manufacturer Warranties
              </h2>
              <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
                We use premium materials from industry-leading manufacturers, each backed by their own warranty program.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {manufacturerWarranties.map((warranty, idx) => (
                <div
                  key={idx}
                  className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 hover:border-brand-green/50 transition-all"
                >
                  <h3 className="text-xl font-bold text-white mb-1">{warranty.brand}</h3>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-brand-green font-semibold">{warranty.coverage}</span>
                    <span className="text-neutral-600">|</span>
                    <span className="text-neutral-400 text-sm">Wind: {warranty.windCoverage}</span>
                  </div>
                  <ul className="space-y-2">
                    {warranty.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={14} />
                        <span className="text-neutral-300">{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How to Make a Warranty Claim */}
      <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                How to Make a Warranty Claim
              </h2>
              <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
                If you experience an issue covered under our workmanship warranty, here is what to do.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              {[
                {
                  icon: Phone,
                  step: 1,
                  title: 'Contact Us',
                  desc: 'Call (256) 274-8530 or submit a service request through our website. Describe the issue you are experiencing.',
                },
                {
                  icon: Clock,
                  step: 2,
                  title: 'Schedule Inspection',
                  desc: 'We will schedule a warranty inspection at a time that works for you, typically within 48 hours.',
                },
                {
                  icon: FileText,
                  step: 3,
                  title: 'Assessment',
                  desc: 'Our team inspects the issue and determines if it falls under the workmanship warranty coverage.',
                },
                {
                  icon: CheckCircle2,
                  step: 4,
                  title: 'Resolution',
                  desc: 'If covered, we schedule and complete the repair at no cost to you. Simple and straightforward.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="text-center">
                    <div className="relative mx-auto mb-4">
                      <div className="w-16 h-16 bg-brand-green rounded-full flex items-center justify-center mx-auto">
                        <Icon className="text-black" size={28} />
                      </div>
                      <div className="absolute -top-2 -right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center text-black font-bold text-sm">
                        {item.step}
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-neutral-400 text-sm">{item.desc}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 bg-neutral-800 border border-brand-green/30 rounded-lg p-6 text-center">
              <p className="text-neutral-300 mb-2">
                <strong className="text-white">Keep your warranty documentation.</strong> After your project is completed,
                you will receive a warranty certificate with your coverage details. Keep this with your home records.
              </p>
              <p className="text-neutral-500 text-sm">
                Warranty is transferable to new homeowners if the property is sold within the warranty period.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto border-l-4 border-brand-green pl-8">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Protect Your Investment
            </h2>
            <p className="text-xl text-neutral-300 mb-8">
              Our industry-leading warranty program means your roof is protected long after the last shingle is laid. Schedule your free inspection today.
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
