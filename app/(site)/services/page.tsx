import Link from 'next/link';
import { getPrimaryServices, getAdditionalServices, services } from '@/lib/servicesData';
import { Home, Wrench, Building2, CloudRain, Flame, Shield, Search, AlertTriangle, Droplet, Wind, Paintbrush, ArrowRight, CheckCircle2 } from 'lucide-react';
import StructuredData from '@/components/StructuredData';
import { generateMetadata as genMeta, generateCollectionPageSchema, generateBreadcrumbSchema } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = genMeta({
  title: 'Roofing Services Decatur & Huntsville AL | Roof Replacement, Repair & Storm Damage',
  description: 'Full-service roofing in Decatur, Huntsville & North Alabama. Residential roof replacement, commercial roofing, storm & hail damage repair, gutter installation, chimney services & free inspections. IKO ROOFPRO, Owens Corning Preferred & Boral Certified. Call (256) 274-8530.',
  path: '/services',
  keywords: ['roofing services Decatur AL', 'roof replacement Huntsville AL', 'roof repair near me', 'commercial roofing Huntsville Decatur AL', 'storm damage roof repair Alabama', 'emergency roof repair North Alabama', 'gutter installation North Alabama', 'chimney repair services Alabama', 'free roof inspection', 'hail damage repair'],
});

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

  const collectionSchema = generateCollectionPageSchema({
    name: 'Roofing Services - Replacement, Repair & Storm Damage',
    description: 'Complete roofing services in Decatur, Huntsville & North Alabama. Residential & commercial roof replacement, repairs, storm damage restoration, and free inspections.',
    url: '/services',
    numberOfItems: services.length,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Services', url: '/services' },
  ]);

  return (
    <div className="min-h-screen">
      <StructuredData data={[collectionSchema, breadcrumbSchema]} />
      {/* Hero Section */}
      <section className="min-h-[50vh] flex items-center justify-center">
        <div className="container mx-auto px-4 text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
            Roofing Services in Decatur, Huntsville &amp; North Alabama
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md">
            Roof replacement, storm damage repair, commercial roofing, gutter installation &amp; free inspections
          </p>
        </div>
      </section>

      {/* Primary Services Section */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Primary Services
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
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
      <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Additional Services
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
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
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Our Service Guarantees
              </h2>
              <p className="text-xl text-gray-300">
                Your satisfaction and protection are our top priorities
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8">
                <div className="flex items-start gap-4 mb-4">
                  <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={32} />
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">
                      5-Year Workmanship Warranty
                    </h3>
                    <p className="text-gray-300">
                      Coverage on all labor, installation defects, and material defects with no hidden conditions. Full coverage commitment.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8">
                <div className="flex items-start gap-4 mb-4">
                  <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={32} />
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">
                      100% Satisfaction Guarantee
                    </h3>
                    <p className="text-gray-300">
                      If not satisfied, we'll make it right. Free touch-up visits within 30 days with ongoing support and problem resolution commitment.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8">
                <div className="flex items-start gap-4 mb-4">
                  <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={32} />
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">
                      No-Leak Guarantee
                    </h3>
                    <p className="text-gray-300">
                      Waterproof protection during warranty period. Emergency repair if issue occurs with professional resolution.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8">
                <div className="flex items-start gap-4 mb-4">
                  <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={32} />
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Insurance Claim Support
                    </h3>
                    <p className="text-gray-300">
                      Expert documentation, fair assessment advocacy, complete claim support with transparent process.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Also Serving Section - Internal Links for SEO */}
      <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-6 text-center">
              Roofing Services Available Throughout North Alabama
            </h2>
            <p className="text-gray-300 text-center mb-8 max-w-3xl mx-auto">
              We provide all of our roofing services across Decatur, Huntsville, Madison, Athens, and surrounding North Alabama communities. Click below to learn more about roofing in your area.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                { slug: 'decatur-al', name: 'Decatur, AL' },
                { slug: 'huntsville-al', name: 'Huntsville, AL' },
                { slug: 'madison-al', name: 'Madison, AL' },
                { slug: 'athens-al', name: 'Athens, AL' },
                { slug: 'hartselle-al', name: 'Hartselle, AL' },
                { slug: 'cullman-al', name: 'Cullman, AL' },
                { slug: 'florence-al', name: 'Florence, AL' },
                { slug: 'moulton-al', name: 'Moulton, AL' },
                { slug: 'owens-crossroads-al', name: 'Owens Cross Roads, AL' },
                { slug: 'albertville-al', name: 'Albertville, AL' },
                { slug: 'guntersville-al', name: 'Guntersville, AL' },
                { slug: 'arab-al', name: 'Arab, AL' },
                { slug: 'scottsboro-al', name: 'Scottsboro, AL' },
                { slug: 'fort-payne-al', name: 'Fort Payne, AL' },
                { slug: 'muscle-shoals-al', name: 'Muscle Shoals, AL' },
                { slug: 'meridianville-al', name: 'Meridianville, AL' },
                { slug: 'hazel-green-al', name: 'Hazel Green, AL' },
                { slug: 'priceville-al', name: 'Priceville, AL' },
                { slug: 'somerville-al', name: 'Somerville, AL' },
                { slug: 'north-alabama', name: 'All of North Alabama' },
              ].map(area => (
                <Link key={area.slug} href={`/service-areas/${area.slug}`} className="text-center py-3 px-4 bg-white/5 border border-white/10 rounded-lg text-gray-300 hover:text-brand-green hover:border-brand-green/50 transition-all text-sm font-medium">
                  {area.name}
                </Link>
              ))}
            </div>
            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                Not sure if we serve your area? <Link href="/contact" className="text-brand-green hover:text-lime-400">Contact us</Link> or <Link href="/check-my-address" className="text-brand-green hover:text-lime-400">check your address</Link> for a free storm report.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-brand-blue">
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
