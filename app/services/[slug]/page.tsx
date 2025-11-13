import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getService, getAllServiceSlugs } from '@/lib/servicesData';
import { Home, Wrench, Building2, CloudRain, Flame, Shield, Search, AlertTriangle, Droplet, Wind, Paintbrush, ArrowLeft, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import type { Metadata } from 'next';

const iconMap: { [key: string]: any } = {
  Home,
  Wrench,
  Building2,
  CloudRain,
  Flame,
  Shield,
  Search,
  AlertTriangle,
  Droplet,
  Wind,
  Paintbrush,
};

export async function generateStaticParams() {
  const slugs = getAllServiceSlugs();
  return slugs.map((slug) => ({
    slug: slug,
  }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const service = getService(params.slug);

  if (!service) {
    return {
      title: 'Service Not Found',
    };
  }

  return {
    title: `${service.title} | River City Roofing Solutions`,
    description: service.description,
  };
}

export default function ServiceDetailPage({ params }: { params: { slug: string } }) {
  const service = getService(params.slug);

  if (!service) {
    notFound();
  }

  const Icon = iconMap[service.icon];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="py-8 bg-gray-50 border-b border-gray-200">
        <div className="container mx-auto px-4">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-brand-blue hover:text-blue-700 font-semibold transition-colors mb-4"
          >
            <ArrowLeft size={20} />
            Back to Services
          </Link>
        </div>
      </section>

      {/* Hero Section */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-brand-blue/10 rounded-full flex items-center justify-center">
                {Icon && <Icon className="text-brand-blue" size={40} />}
              </div>
              <div>
                <div className="inline-block bg-brand-green/10 text-brand-green px-3 py-1 rounded-full text-sm font-semibold mb-2">
                  {service.category} Service
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-brand-black">
                  {service.title}
                </h1>
              </div>
            </div>

            <p className="text-xl text-gray-600 leading-relaxed">
              {service.description}
            </p>

            {/* Quick Info Cards */}
            <div className="grid md:grid-cols-2 gap-4 mt-8">
              {service.costRange && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                  <DollarSign className="text-brand-green" size={32} />
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Cost Range</p>
                    <p className="text-lg font-bold text-brand-black">{service.costRange}</p>
                  </div>
                </div>
              )}

              {service.timeline && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                  <Clock className="text-brand-blue" size={32} />
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Timeline</p>
                    <p className="text-lg font-bold text-brand-black">{service.timeline}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12">
              {/* What's Included */}
              {service.whatsIncluded && service.whatsIncluded.length > 0 && (
                <div>
                  <h2 className="text-3xl font-bold text-brand-black mb-6">
                    What's Included
                  </h2>
                  <ul className="space-y-3">
                    {service.whatsIncluded.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="text-brand-green mt-1 flex-shrink-0" size={20} />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Services Included */}
              {service.servicesIncluded && service.servicesIncluded.length > 0 && (
                <div>
                  <h2 className="text-3xl font-bold text-brand-black mb-6">
                    Services Included
                  </h2>
                  <ul className="space-y-3">
                    {service.servicesIncluded.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="text-brand-green mt-1 flex-shrink-0" size={20} />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Features */}
              {service.features && service.features.length > 0 && (
                <div>
                  <h2 className="text-3xl font-bold text-brand-black mb-6">
                    Features
                  </h2>
                  <ul className="space-y-3">
                    {service.features.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="text-brand-green mt-1 flex-shrink-0" size={20} />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Benefits */}
              {service.keyBenefits && service.keyBenefits.length > 0 && (
                <div>
                  <h2 className="text-3xl font-bold text-brand-black mb-6">
                    Key Benefits
                  </h2>
                  <ul className="space-y-3">
                    {service.keyBenefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="text-brand-green mt-1 flex-shrink-0" size={20} />
                        <span className="text-gray-700">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Materials Available */}
            {service.materialsAvailable && service.materialsAvailable.length > 0 && (
              <div className="mt-12 pt-12 border-t border-gray-200">
                <h2 className="text-3xl font-bold text-brand-black mb-6">
                  Materials Available
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {service.materialsAvailable.map((material, idx) => (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                      <CheckCircle2 className="text-brand-blue flex-shrink-0" size={20} />
                      <span className="text-gray-700 font-medium">{material}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ideal For */}
            {service.idealFor && service.idealFor.length > 0 && (
              <div className="mt-12 pt-12 border-t border-gray-200">
                <h2 className="text-3xl font-bold text-brand-black mb-6">
                  Ideal For
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {service.idealFor.map((item, idx) => (
                    <div key={idx} className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-4 flex items-center gap-3">
                      <CheckCircle2 className="text-brand-blue flex-shrink-0" size={20} />
                      <span className="text-gray-700 font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-brand-blue">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Interested in {service.title}?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Get a free inspection and detailed estimate from our expert team.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact" className="btn-modern btn-accent">
                Get Free Inspection
              </Link>
              <Link href="tel:256-274-8530" className="btn-modern bg-white text-brand-blue hover:bg-gray-100">
                Call (256) 274-8530
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Back to Services Link */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4 text-center">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-brand-blue hover:text-blue-700 font-semibold text-lg transition-colors"
          >
            <ArrowLeft size={20} />
            View All Services
          </Link>
        </div>
      </section>
    </div>
  );
}
