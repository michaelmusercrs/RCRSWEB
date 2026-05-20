import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getService, getAllServiceSlugs, services } from '@/lib/servicesData';
import { Home, Wrench, Building2, CloudRain, Flame, Shield, Search, AlertTriangle, Droplet, Wind, Paintbrush, ArrowRight, CheckCircle2, XCircle, Clock, MapPin, Phone, ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import StructuredData from '@/components/StructuredData';
import { siteConfig, generateServiceSchema, generateBreadcrumbSchema, generateFAQSchema } from '@/lib/seo';
import {
  COUNTY_CALLOUTS,
  getServiceEnhancement,
} from '@/lib/serviceEnhancements';

const iconMap: { [key: string]: any } = { Home, Wrench, Building2, CloudRain, Flame, Shield, Search, AlertTriangle, Droplet, Wind, Paintbrush };

export async function generateStaticParams() {
  return getAllServiceSlugs().map((slug) => ({ slug }));
}

// SEO-optimized meta descriptions per service slug
const serviceMetaMap: Record<string, { title: string; description: string; keywords: string[] }> = {
  'residential-roof-replacement': {
    title: 'Roof Replacement Decatur & Huntsville AL | Free Estimate',
    description: 'Expert residential roof replacement in Decatur, Huntsville, Madison & North Alabama. IKO ROOFPRO Craftsman Premier & Owens Corning Preferred Contractor. 5-year workmanship warranty. Free inspection — call (256) 274-8530.',
    keywords: ['roof replacement Decatur AL', 'roof replacement Huntsville AL', 'new roof cost North Alabama', 'residential roofer near me', 'shingle roof replacement Alabama', 'IKO Dynasty shingles', 'Owens Corning Preferred Contractor'],
  },
  'residential-roof-repair': {
    title: 'Roof Repair Decatur & Huntsville AL | Same-Day Service Available',
    description: 'Fast, affordable roof repair in Decatur, Huntsville & North Alabama. Leak repair, shingle replacement, flashing repair & emergency tarping. Licensed & insured. Free estimate — call (256) 274-8530.',
    keywords: ['roof repair Decatur AL', 'roof repair Huntsville AL', 'roof repair near me', 'roof leak repair North Alabama', 'emergency roof repair Alabama', 'shingle repair Decatur'],
  },
  'commercial-roofing': {
    title: 'Commercial Roofing Huntsville & Decatur AL | TPO, EPDM & Metal',
    description: 'Commercial roofing contractor serving Huntsville, Decatur & North Alabama. TPO, EPDM, modified bitumen & metal roofing for flat and low-slope buildings. Maintenance programs available. Call (256) 274-8530.',
    keywords: ['commercial roofing Huntsville AL', 'commercial roofing Decatur AL', 'commercial roof repair North Alabama', 'TPO roofing Alabama', 'flat roof contractor Huntsville', 'business roofing services'],
  },
  'storm-hail-damage-repair': {
    title: 'Storm & Hail Damage Roof Repair North Alabama | Insurance Claims Expert',
    description: 'Storm damage roof repair in Decatur, Huntsville & North Alabama. 24/7 emergency response, hail damage restoration & full insurance claim support. Free storm damage inspection — call (256) 274-8530.',
    keywords: ['storm damage roof repair Alabama', 'hail damage roof repair Decatur AL', 'hail damage roof repair Huntsville AL', 'insurance claim roofing contractor', 'emergency roof repair North Alabama', 'wind damage roofer'],
  },
  'chimney-services': {
    title: 'Chimney Repair & Cap Installation Decatur AL | North Alabama',
    description: 'Professional chimney cap installation, chimney crown repair & flashing services in Decatur, Huntsville & North Alabama. Prevent water damage and pest intrusion. Free inspection — call (256) 274-8530.',
    keywords: ['chimney repair services Alabama', 'chimney cap installation Decatur AL', 'chimney flashing repair Huntsville', 'chimney services North Alabama', 'chimney crown repair Alabama'],
  },
  'leafx-gutter-protection': {
    title: 'Gutter Guards & LeafX Gutter Protection | Decatur & Huntsville AL',
    description: 'LeafX gutter guard installation by a Boral Certified LeafX Dealer in Decatur, Huntsville & North Alabama. Lifetime clog-free guarantee, .024-gauge aluminum, no roof penetration. Call (256) 274-8530.',
    keywords: ['gutter installation North Alabama', 'gutter guards Decatur AL', 'LeafX gutter protection Huntsville', 'gutter guard installation Alabama', 'clog free gutter system', 'gutter protection near me', 'Boral certified LeafX dealer'],
  },
  'roof-inspections-maintenance': {
    title: 'Free Roof Inspection Decatur & Huntsville AL | Annual Maintenance',
    description: 'Free roof inspections in Decatur, Huntsville, Madison & North Alabama. Annual maintenance programs, pre-purchase inspections, storm damage assessments & insurance documentation. Call (256) 274-8530.',
    keywords: ['free roof inspection Decatur AL', 'free roof inspection Huntsville AL', 'roof inspection near me', 'roof maintenance North Alabama', 'annual roof inspection Alabama', 'pre-purchase roof inspection'],
  },
  'emergency-roof-services': {
    title: 'Emergency Roof Repair North Alabama | 24/7 Service Decatur & Huntsville',
    description: '24/7 emergency roof repair in Decatur, Huntsville & North Alabama. Same-day tarping, storm damage response & water damage mitigation. When disaster strikes, call (256) 274-8530 now.',
    keywords: ['emergency roof repair North Alabama', 'emergency roof repair Decatur AL', 'emergency roof repair Huntsville AL', '24/7 roofer Alabama', 'emergency tarping service', 'storm damage emergency response'],
  },
  'gutter-repair-replacement': {
    title: 'Gutter Repair & Replacement Decatur AL | Seamless Gutters',
    description: 'Professional gutter repair and seamless gutter replacement in Decatur, Huntsville & North Alabama. Downspout repair, gutter cleaning & water diversion solutions. Call (256) 274-8530 for a free estimate.',
    keywords: ['gutter repair Decatur AL', 'gutter replacement Huntsville AL', 'seamless gutters North Alabama', 'gutter installation near me', 'downspout repair Alabama', 'gutter cleaning service'],
  },
  'attic-ventilation': {
    title: 'Attic Ventilation Solutions Decatur & Huntsville AL',
    description: 'Improve your home\'s energy efficiency with attic ventilation solutions in Decatur, Huntsville & North Alabama. Ridge vents, soffit vents & proper airflow calculation. Reduce cooling costs. Call (256) 274-8530.',
    keywords: ['attic ventilation Decatur AL', 'attic ventilation Huntsville AL', 'ridge vent installation Alabama', 'soffit vent repair North Alabama', 'energy efficient roofing Alabama', 'attic airflow solutions'],
  },
  'roof-coating-treatment': {
    title: 'Roof Coating & Treatment Services | Decatur & North Alabama',
    description: 'Extend your roof\'s life with protective coatings and treatments in Decatur, Huntsville & North Alabama. Algae-resistant, UV protection & waterproof sealants. Call (256) 274-8530 for a free assessment.',
    keywords: ['roof coating Decatur AL', 'roof treatment North Alabama', 'roof sealant Huntsville AL', 'UV protection roof coating', 'algae resistant roof treatment', 'reflective roof coating Alabama'],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return { title: 'Service Not Found' };

  const path = `/services/${slug}`;
  const meta = serviceMetaMap[slug];

  // Use SEO-optimized meta if available, otherwise generate from service data
  const title = meta?.title || `${service.title} Decatur & Huntsville AL | River City Roofing`;
  const description = meta?.description || (service.description.length > 155
    ? service.description.substring(0, 155) + '...'
    : service.description + ` in Decatur, Huntsville & North Alabama. Free inspection — call (256) 274-8530.`);
  const keywords = meta?.keywords || [`${service.title.toLowerCase()} Decatur AL`, `${service.title.toLowerCase()} Huntsville AL`, `${service.title.toLowerCase()} North Alabama`];

  // OG image is auto-generated by app/(site)/services/[slug]/opengraph-image.tsx
  // which Next.js auto-discovers. We still surface a static fallback image URL
  // for crawlers that miss the dynamic route.
  const ogImageUrl = `${siteConfig.url}${path}/opengraph-image`;

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}${path}`,
      siteName: siteConfig.name,
      type: 'website',
      locale: 'en_US',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();
  const Icon = iconMap[service.icon];
  const items = service.whatsIncluded || service.servicesIncluded || service.features || [];

  // Pull the deeper enhancement bundle (process steps, includes/excludes, related
  // services) if this slug is one of the 5 high-value enhanced pages. Falls
  // back to `undefined` for everything else so the page still renders normally.
  const enhancement = getServiceEnhancement(slug);

  // Generate structured data for service page.
  // Attach a price: '0' Offer to the free-inspection service so SERPs can
  // show a "Free" rich-result badge. Other services don't get an Offer
  // here — we'd be inventing prices we don't publish.
  //
  // For the 5 enhanced services we also attach a ServiceChannel pointing at
  // the phone line + contact form, so search engines have an explicit intake
  // path bound to the Service node.
  const serviceSchema = generateServiceSchema({
    name: service.title,
    description: service.description,
    image: service.image,
    url: `${siteConfig.url}/services/${slug}`,
    includeServiceChannel: Boolean(enhancement),
    ...(slug === 'roof-inspections-maintenance' && {
      offer: {
        price: '0',
        priceCurrency: 'USD',
        description: 'Free, no-obligation roof inspection with photo documentation. Available across North Alabama.',
      },
    }),
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Services', url: '/services' },
    { name: service.title, url: `/services/${slug}` },
  ]);

  // Generate service-specific FAQs
  const serviceFAQs = [
    {
      question: `How much does ${service.title.toLowerCase()} cost in North Alabama?`,
      answer: `The cost of ${service.title.toLowerCase()} varies based on your specific situation. Contact us for a free inspection and detailed quote with no obligation.`,
    },
    {
      question: `Do you offer free estimates for ${service.title.toLowerCase()}?`,
      answer: `Yes! River City Roofing Solutions provides completely free, no-obligation estimates for ${service.title.toLowerCase()} in Decatur, Huntsville, Madison, Athens, and all of North Alabama. Call (256) 274-8530 to schedule yours.`,
    },
    {
      question: `How long does ${service.title.toLowerCase()} take?`,
      answer: service.timeline
        ? `${service.title} typically takes ${service.timeline}. We work efficiently to minimize disruption while ensuring top-quality workmanship on every project.`
        : `The timeline for ${service.title.toLowerCase()} depends on the scope of work. Contact us for a detailed project timeline during your free inspection.`,
    },
    {
      question: `What areas do you serve for ${service.title.toLowerCase()}?`,
      answer: `We provide ${service.title.toLowerCase()} throughout North Alabama including Decatur, Huntsville, Madison, Athens, Hartselle, Cullman, Florence, Moulton, and surrounding communities. Contact us to confirm service in your area.`,
    },
  ];

  const faqSchema = generateFAQSchema(serviceFAQs);

  return (
    <div className="min-h-screen">
      {/* Service, Breadcrumb, and FAQ Schema */}
      <StructuredData data={[serviceSchema, breadcrumbSchema, faqSchema]} />
      <section className="relative min-h-[60vh] flex items-center">
        {service.image && (
          <div className="absolute inset-0 z-0">
            <Image src={service.image} alt={service.title} fill className="object-cover" priority />
            <div className="absolute inset-0 bg-black/60" />
          </div>
        )}
        <div className="container mx-auto px-4 relative z-10">
          <Link href="/services" className="inline-flex items-center gap-2 text-white/80 hover:text-brand-green mb-6 transition-colors">
            <ArrowLeft size={20} /> Back to Services
          </Link>
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
              {Icon && <div className="w-20 h-20 bg-brand-green/20 backdrop-blur-sm rounded-full flex items-center justify-center"><Icon className="text-brand-green" size={40} /></div>}
              <span className="px-4 py-2 bg-brand-green/20 backdrop-blur-sm rounded-full text-brand-green font-semibold">{service.category} Service</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">{service.title} in Decatur, Huntsville &amp; North Alabama</h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl drop-shadow-md">{service.description}</p>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold text-white mb-8">{service.whatsIncluded ? "What's Included" : "Services Included"}</h2>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-8">
              {service.keyBenefits && (
                <div>
                  <h2 className="text-3xl font-bold text-white mb-8">Key Benefits</h2>
                  <div className="space-y-4">
                    {service.keyBenefits.map((benefit, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <CheckCircle2 className="text-brand-blue flex-shrink-0 mt-1" size={20} />
                        <span className="text-gray-300">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {service.timeline && (
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-2">Timeline</h3>
                  <p className="text-gray-300">{service.timeline}</p>
                </div>
              )}
              {service.idealFor && (
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Ideal For</h3>
                  <ul className="space-y-2">
                    {service.idealFor.map((item, index) => (
                      <li key={index} className="text-gray-300 flex items-center gap-2"><ArrowRight className="text-brand-green" size={16} />{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Process Section — only rendered for enhanced services.
          Walks the visitor through how the service actually happens, step by
          step, with real timing ranges. This is the section that turns
          informational traffic into qualified leads. */}
      {enhancement && (
        <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm border-t border-white/10">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  {enhancement.processHeadline}
                </h2>
                <p className="text-lg text-gray-300 max-w-3xl mx-auto">
                  {enhancement.processIntro}
                </p>
              </div>
              <ol className="space-y-4">
                {enhancement.process.map((step, idx) => (
                  <li
                    key={idx}
                    className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-brand-green/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-green/20 border border-brand-green/40 flex items-center justify-center text-brand-green font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                          <h3 className="text-xl font-bold text-white">
                            {step.title}
                          </h3>
                          <span className="inline-flex items-center gap-2 text-sm text-brand-green font-semibold">
                            <Clock size={14} /> {step.timing}
                          </span>
                        </div>
                        <p className="text-gray-300 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}

      {/* What's Included / Not Included — explicit two-column comparison so
          there's no ambiguity about scope. Honesty about exclusions also tends
          to convert better than the standard "everything is included" puffery. */}
      {enhancement && (
        <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm border-t border-white/10">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-10 text-center">
                What&apos;s Included &mdash; And What&apos;s Not
              </h2>
              <div className="grid md:grid-cols-2 gap-6 md:gap-10">
                <div className="bg-white/5 border border-brand-green/30 rounded-2xl p-6 md:p-8">
                  <h3 className="text-2xl font-bold text-brand-green mb-6 flex items-center gap-2">
                    <CheckCircle2 size={24} /> Included in this service
                  </h3>
                  <ul className="space-y-3">
                    {enhancement.includes.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-gray-200">
                        <CheckCircle2
                          className="text-brand-green flex-shrink-0 mt-1"
                          size={18}
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">
                  <h3 className="text-2xl font-bold text-gray-300 mb-6 flex items-center gap-2">
                    <XCircle size={24} className="text-gray-400" /> Not included
                  </h3>
                  <ul className="space-y-3">
                    {enhancement.notIncluded.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-gray-400">
                        <XCircle
                          className="text-gray-500 flex-shrink-0 mt-1"
                          size={18}
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500 mt-6 italic">
                    If your project needs something not listed, just ask &mdash; we
                    can usually coordinate or refer you to a trusted partner.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Related Services — topic-cluster cross-links. Spreads link equity to
          the other high-value service pages and helps Google understand how
          this service relates to the broader roofing offering. */}
      {enhancement && (
        <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm border-t border-white/10">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                  Related Roofing Services
                </h2>
                <p className="text-gray-300 max-w-3xl mx-auto">
                  Most {service.title.toLowerCase()} jobs touch one or more of
                  these adjacent services. Bundling on a single visit usually
                  saves time and money.
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {enhancement.related.map((rel) => (
                  <Link
                    key={rel.slug}
                    href={`/services/${rel.slug}`}
                    className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-brand-green/50 transition-colors block"
                  >
                    <h3 className="text-xl font-bold text-white group-hover:text-brand-green transition-colors mb-3 flex items-center gap-2">
                      {rel.title}
                      <ArrowRight
                        size={18}
                        className="text-brand-green opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {rel.tease}
                    </p>
                  </Link>
                ))}
              </div>
              <div className="text-center mt-8 text-sm text-gray-400 space-y-1">
                <p>
                  See our full{' '}
                  <Link href="/services" className="text-brand-green hover:text-lime-400">
                    services catalog
                  </Link>
                  , browse the{' '}
                  <Link href="/gallery" className="text-brand-green hover:text-lime-400">
                    project gallery
                  </Link>
                  , or{' '}
                  <Link href="/contact" className="text-brand-green hover:text-lime-400">
                    schedule a free inspection
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* County Callouts — binds the service page to the 5 county landing
          pages (Madison, Morgan, Marshall, Limestone, Cullman). These are the
          highest-population and highest-claim-volume counties in our footprint;
          each county landing ranks for "roofing contractor <county>" queries
          and this section feeds link equity into them. */}
      {enhancement && (
        <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm border-t border-white/10">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                  Serving North Alabama
                </h2>
                <p className="text-gray-300 max-w-3xl mx-auto">
                  We deliver {service.title.toLowerCase()} across our full
                  15-county footprint in North Alabama. Five counties carry the
                  bulk of our volume &mdash; here is the local context for each.
                </p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {COUNTY_CALLOUTS.map((county) => (
                  <Link
                    key={county.slug}
                    href={`/roofing-contractor/${county.slug}`}
                    className="group bg-white/5 border border-white/10 rounded-xl p-5 hover:border-brand-green/50 transition-colors block"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="text-brand-green" size={18} />
                      <h3 className="text-lg font-bold text-white group-hover:text-brand-green transition-colors">
                        {county.name} County, AL
                      </h3>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {county.copy}
                    </p>
                    <p className="mt-3 text-xs text-brand-green font-semibold inline-flex items-center gap-1">
                      {service.title} in {county.name} County
                      <ArrowRight size={12} />
                    </p>
                  </Link>
                ))}
              </div>
              <div className="text-center mt-8 text-sm text-gray-400">
                <p>
                  Not sure which county you&apos;re in? Use our{' '}
                  <Link
                    href="/check-my-address"
                    className="text-brand-green hover:text-lime-400"
                  >
                    address checker
                  </Link>{' '}
                  for a recent storm report, or browse all{' '}
                  <Link
                    href="/service-areas"
                    className="text-brand-green hover:text-lime-400"
                  >
                    service areas
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Insurance Carriers - Storm Damage only */}
      {slug === 'storm-hail-damage-repair' && (
        <section className="py-10 px-4 bg-black/70 backdrop-blur-sm border-t border-white/10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-3">We Work With All Major Insurance Carriers</h2>
            <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
              Our team handles the documentation, adjuster meetings, and claim process so you get the coverage you deserve — at $0 beyond your deductible.
            </p>
            <div className="flex flex-wrap justify-center gap-6 md:gap-10 text-neutral-400">
              {['State Farm', 'Allstate', 'Farmers', 'USAA', 'Liberty Mutual', 'Nationwide', 'Progressive', 'Alfa Insurance', 'Erie', 'Travelers'].map((carrier) => (
                <div key={carrier} className="bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-sm font-medium text-neutral-300 hover:border-brand-green/50 transition-colors">
                  {carrier}
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-500 mt-6">
              We work with virtually all insurance companies. Don&apos;t see yours listed? Call us — we&apos;ve probably worked with them.
            </p>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
              Frequently Asked Questions About {service.title}
            </h2>
            <div className="space-y-4">
              {serviceFAQs.map((faq, idx) => (
                <details key={idx} className="bg-white/5 border border-white/10 rounded-xl p-6 group hover:border-brand-green/50 transition-colors">
                  <summary className="font-bold text-white cursor-pointer list-none flex justify-between items-center">
                    {faq.question}
                    <CheckCircle2 className="h-5 w-5 text-brand-green flex-shrink-0 ml-4" />
                  </summary>
                  <p className="text-gray-300 mt-4 leading-relaxed">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Internal Links */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              Related Roofing Services &amp; Areas We Serve
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-brand-green mb-3">More Roofing Services</h3>
                <ul className="space-y-2">
                  {services.filter(s => s.slug !== slug).slice(0, 7).map(s => (
                    <li key={s.slug}><Link href={`/services/${s.slug}`} className="text-gray-300 hover:text-brand-green transition-colors">{s.title}</Link></li>
                  ))}
                  <li><Link href="/services" className="text-brand-green font-semibold hover:text-lime-400 transition-colors">View All Services →</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-brand-green mb-3">{service.title} Available In</h3>
                <ul className="space-y-2">
                  <li><Link href="/service-areas/decatur-al" className="text-gray-300 hover:text-brand-green transition-colors">{service.title} in Decatur, AL</Link></li>
                  <li><Link href="/service-areas/huntsville-al" className="text-gray-300 hover:text-brand-green transition-colors">{service.title} in Huntsville, AL</Link></li>
                  <li><Link href="/service-areas/madison-al" className="text-gray-300 hover:text-brand-green transition-colors">{service.title} in Madison, AL</Link></li>
                  <li><Link href="/service-areas/athens-al" className="text-gray-300 hover:text-brand-green transition-colors">{service.title} in Athens, AL</Link></li>
                  <li><Link href="/service-areas/hartselle-al" className="text-gray-300 hover:text-brand-green transition-colors">{service.title} in Hartselle, AL</Link></li>
                  <li><Link href="/service-areas/cullman-al" className="text-gray-300 hover:text-brand-green transition-colors">{service.title} in Cullman, AL</Link></li>
                  <li><Link href="/service-areas/florence-al" className="text-gray-300 hover:text-brand-green transition-colors">{service.title} in Florence, AL</Link></li>
                  <li><Link href="/service-areas/moulton-al" className="text-gray-300 hover:text-brand-green transition-colors">{service.title} in Moulton, AL</Link></li>
                  <li><Link href="/service-areas" className="text-brand-green font-semibold hover:text-lime-400 transition-colors">View All Service Areas →</Link></li>
                </ul>
              </div>
            </div>
            <div className="mt-6 text-center space-y-2">
              <p className="text-gray-400 text-sm">
                Read our <Link href="/blog" className="text-brand-green hover:text-lime-400">roofing blog</Link> for expert tips on {service.title.toLowerCase()} and roof maintenance in North Alabama.
              </p>
              <p className="text-gray-400 text-sm">
                <Link href="/check-my-address" className="text-brand-green hover:text-lime-400">Check your address</Link> for recent storm activity, or <Link href="/contact" className="text-brand-green hover:text-lime-400">schedule a free inspection</Link> today.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-brand-blue">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-blue-50 mb-8">Contact us today for a free inspection and quote.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact" className="inline-flex items-center justify-center gap-2 bg-brand-green text-black font-bold px-8 py-4 rounded-full hover:bg-lime-400 transition-colors">
              Get Free Quote <ArrowRight size={20} />
            </Link>
            <a href="tel:256-274-8530" className="inline-flex items-center justify-center gap-2 bg-white text-brand-blue font-bold px-8 py-4 rounded-full hover:bg-gray-100 transition-colors">
              <Phone size={20} /> (256) 274-8530
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

