import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getService, getAllServiceSlugs, services } from '@/lib/servicesData';
import { Home, Wrench, Building2, CloudRain, Flame, Shield, Search, AlertTriangle, Droplet, Wind, Paintbrush, ArrowRight, CheckCircle2, Phone, ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { siteConfig } from '@/lib/seo';

const iconMap: { [key: string]: any } = { Home, Wrench, Building2, CloudRain, Flame, Shield, Search, AlertTriangle, Droplet, Wind, Paintbrush };

export async function generateStaticParams() {
  return getAllServiceSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return { title: 'Service Not Found' };

  const path = `/services/${slug}`;
  const url = `${siteConfig.url}${path}`;

  // Create unique, descriptive title for each service
  const title = `${service.title} in North Alabama | River City Roofing`;
  const description = service.description.length > 155
    ? service.description.substring(0, 155) + '...'
    : service.description;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
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

  return (
    <div className="min-h-screen">
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

