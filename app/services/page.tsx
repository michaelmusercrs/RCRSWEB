import Link from 'next/link';
import { getPrimaryServices, getAdditionalServices } from '@/lib/servicesData';
import { Home, Wrench, Building2, CloudRain, Flame, Shield, Search, AlertTriangle, Droplet, Wind, Paintbrush, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Roofing Services | River City Roofing Solutions',
  description: 'Comprehensive roofing services including residential replacement, commercial roofing, storm damage repair, inspections, and more. Serving North Alabama with expert care.',
  keywords: ['roofing services', 'roof replacement', 'roof repair', 'commercial roofing', 'storm damage', 'North Alabama'],
};

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

export default function ServicesPage() {
  const primaryServices = getPrimaryServices();
  const additionalServices = getAdditionalServices();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative w-full h-[40vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 z-0" />
        <div className="absolute inset-0 bg-black/50 z-10" />

        <div className="relative z-20 container mx-auto px-4 text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            Our Services
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto">
            Comprehensive roofing solutions for residential and commercial properties
          </p>
        </div>
      </section>

      {/* Primary Services Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-4">
                Primary Services
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Full-service roofing solutions backed by our 5-year workmanship warranty
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {primaryServices.map((service) => {
                const Icon = iconMap[service.icon];
                return (
                  <Link
                    key={service.id}
                    href={`/services/${service.slug}`}
                    className="group bg-white card-modern border border-gray-200 hover:border-brand-blue p-6"
                  >
                    <div className="mb-4">
                      <div className="w-16 h-16 bg-brand-blue/10 rounded-full flex items-center justify-center group-hover:bg-brand-blue/20 transition-colors">
                        {Icon && <Icon className="text-brand-blue" size={32} />}
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-brand-black mb-3 group-hover:text-brand-blue transition-colors">
                      {service.title}
                    </h3>

                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {service.description}
                    </p>

                    {service.costRange && (
                      <p className="text-sm font-semibold text-brand-green mb-4">
                        {service.costRange}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-brand-blue font-semibold group-hover:gap-3 transition-all">
                      Learn More
                      <ArrowRight size={18} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Additional Services Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-4">
                Additional Services
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Complementary services to keep your entire roofing system in top condition
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {additionalServices.map((service) => {
                const Icon = iconMap[service.icon];
                return (
                  <Link
                    key={service.id}
                    href={`/services/${service.slug}`}
                    className="group bg-white card-modern border border-gray-200 hover:border-brand-blue p-6"
                  >
                    <div className="mb-4">
                      <div className="w-16 h-16 bg-brand-green/10 rounded-full flex items-center justify-center group-hover:bg-brand-green/20 transition-colors">
                        {Icon && <Icon className="text-brand-green" size={32} />}
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-brand-black mb-3 group-hover:text-brand-blue transition-colors">
                      {service.title}
                    </h3>

                    <p className="text-gray-600 mb-4">
                      {service.description}
                    </p>

                    {service.costRange && (
                      <p className="text-sm font-semibold text-brand-green mb-4">
                        {service.costRange}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-brand-blue font-semibold group-hover:gap-3 transition-all">
                      Learn More
                      <ArrowRight size={18} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Service Guarantees Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-4">
                Our Service Guarantees
              </h2>
              <p className="text-xl text-gray-600">
                Your satisfaction and protection are our top priorities
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8">
                <div className="flex items-start gap-4 mb-4">
                  <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={32} />
                  <div>
                    <h3 className="text-2xl font-bold text-brand-black mb-2">
                      5-Year Workmanship Warranty
                    </h3>
                    <p className="text-gray-600">
                      Coverage on all labor, installation defects, and material defects with no hidden conditions. Full coverage commitment.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8">
                <div className="flex items-start gap-4 mb-4">
                  <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={32} />
                  <div>
                    <h3 className="text-2xl font-bold text-brand-black mb-2">
                      100% Satisfaction Guarantee
                    </h3>
                    <p className="text-gray-600">
                      If not satisfied, we'll make it right. Free touch-up visits within 30 days with ongoing support and problem resolution commitment.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8">
                <div className="flex items-start gap-4 mb-4">
                  <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={32} />
                  <div>
                    <h3 className="text-2xl font-bold text-brand-black mb-2">
                      No-Leak Guarantee
                    </h3>
                    <p className="text-gray-600">
                      Waterproof protection during warranty period. Emergency repair if issue occurs with professional resolution.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8">
                <div className="flex items-start gap-4 mb-4">
                  <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={32} />
                  <div>
                    <h3 className="text-2xl font-bold text-brand-black mb-2">
                      Insurance Claim Support
                    </h3>
                    <p className="text-gray-600">
                      Expert documentation, fair assessment advocacy, complete claim support with transparent process.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-brand-blue">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Schedule your free inspection today and discover why North Alabama trusts River City Roofing Solutions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact" className="btn-modern btn-accent">
                Get Free Inspection
              </Link>
              <Link href="/service-areas" className="btn-modern bg-white text-brand-blue hover:bg-gray-100">
                View Service Areas
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
