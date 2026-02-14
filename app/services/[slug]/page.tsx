import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getService, getAllServiceSlugs, services } from '@/lib/servicesData';
import { Home, Wrench, Building2, CloudRain, Flame, Shield, Search, AlertTriangle, Droplet, Wind, Paintbrush, ArrowRight, CheckCircle2, Phone, ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import StructuredData from '@/components/StructuredData';
import { siteConfig, generateServiceSchema, generateBreadcrumbSchema, generateFAQSchema } from '@/lib/seo';

const iconMap: { [key: string]: any } = { Home, Wrench, Building2, CloudRain, Flame, Shield, Search, AlertTriangle, Droplet, Wind, Paintbrush };

export async function generateStaticParams() {
  return getAllServiceSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return { title: 'Service Not Found' };

  const path = `/services/${slug}`;

  // Create unique, descriptive title for each service
  const title = `${service.title} in North Alabama | River City Roofing`;
  const description = service.description.length > 155
    ? service.description.substring(0, 155) + '...'
    : service.description;

  return {
    title,
    description,
    // Use path - Next.js combines with metadataBase to create full canonical URL
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}${path}`,
      siteName: siteConfig.name,
      type: 'website',
    },
  };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();
  const Icon = iconMap[service.icon];
  const items = service.whatsIncluded || service.servicesIncluded || service.features || [];

  // Generate structured data for service page
  const serviceSchema = generateServiceSchema({
    name: service.title,
    description: service.description,
    image: service.image,
    url: `${siteConfig.url}/services/${slug}`,
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
      answer: service.costRange
        ? `${service.title} in North Alabama typically costs ${service.costRange}. The exact cost depends on your roof size, materials chosen, and project complexity. We provide free detailed quotes with no obligation.`
        : `The cost of ${service.title.toLowerCase()} varies based on your specific situation. Contact us for a free inspection and detailed quote with no obligation.`,
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
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">{service.title}</h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl drop-shadow-md">{service.description}</p>
            {service.costRange && (
              <div className="inline-block bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-6 py-3">
                <span className="text-white/70 text-sm">Starting from</span>
                <p className="text-2xl font-bold text-brand-green">{service.costRange}</p>
              </div>
            )}
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
              Related Services & Service Areas
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-brand-green mb-3">More Services</h3>
                <ul className="space-y-2">
                  {services.filter(s => s.slug !== slug).slice(0, 5).map(s => (
                    <li key={s.slug}><Link href={`/services/${s.slug}`} className="text-gray-300 hover:text-brand-green transition-colors">{s.title}</Link></li>
                  ))}
                  <li><Link href="/services" className="text-brand-green font-semibold hover:text-lime-400 transition-colors">View All Services →</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-brand-green mb-3">We Serve These Areas</h3>
                <ul className="space-y-2">
                  <li><Link href="/service-areas/decatur-al" className="text-gray-300 hover:text-brand-green transition-colors">{service.title} in Decatur, AL</Link></li>
                  <li><Link href="/service-areas/huntsville-al" className="text-gray-300 hover:text-brand-green transition-colors">{service.title} in Huntsville, AL</Link></li>
                  <li><Link href="/service-areas/madison-al" className="text-gray-300 hover:text-brand-green transition-colors">{service.title} in Madison, AL</Link></li>
                  <li><Link href="/service-areas/athens-al" className="text-gray-300 hover:text-brand-green transition-colors">{service.title} in Athens, AL</Link></li>
                  <li><Link href="/service-areas" className="text-brand-green font-semibold hover:text-lime-400 transition-colors">View All Areas →</Link></li>
                </ul>
              </div>
            </div>
            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                Read our <Link href="/blog" className="text-brand-green hover:text-lime-400">roofing blog</Link> for expert tips, or <Link href="/check-my-address" className="text-brand-green hover:text-lime-400">check your address</Link> for recent storm activity.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-brand-blue">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-blue-100 mb-8">Contact us today for a free inspection and quote.</p>
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

