import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getServiceArea, getAllServiceAreaSlugs, getPrimaryServices } from '@/lib/servicesData';
import { MapPin, Clock, CheckCircle2, Phone, ArrowRight, ArrowLeft, Home, Wrench, Building2, CloudRain, Flame, Shield, Search, AlertTriangle } from 'lucide-react';
import { generateBreadcrumbSchema, generateFAQSchema, siteConfig } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';
import type { Metadata } from 'next';

const iconMap: { [key: string]: any } = { Home, Wrench, Building2, CloudRain, Flame, Shield, Search, AlertTriangle };

export async function generateStaticParams() {
  return getAllServiceAreaSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const area = getServiceArea(slug);
  if (!area) return { title: 'Area Not Found' };

  const path = `/service-areas/${slug}`;
  const url = `${siteConfig.url}${path}`;
  const title = `Roofing Services in ${area.name}, ${area.state} | River City Roofing`;
  const description = area.description || `Professional roofing services in ${area.name}. Residential and commercial roofing, storm damage repair, and free inspections.`;
  const truncatedDesc = description.length > 155 ? description.substring(0, 155) + '...' : description;

  return {
    title,
    description: truncatedDesc,
    // Use path - Next.js combines with metadataBase for full canonical URL
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description: truncatedDesc,
      url: `${siteConfig.url}${path}`,
      siteName: siteConfig.name,
      type: 'website',
    },
  };
}

export default async function ServiceAreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const area = getServiceArea(slug);
  if (!area) notFound();
  const services = getPrimaryServices().slice(0, 4);

  // Geo coordinates for service areas
  const geoCoords: Record<string, { lat: number; lng: number }> = {
    'decatur-al': { lat: 34.6059, lng: -86.9833 },
    'huntsville-al': { lat: 34.7304, lng: -86.5861 },
    'madison-al': { lat: 34.6993, lng: -86.7483 },
    'athens-al': { lat: 34.8029, lng: -86.9717 },
    'owens-crossroads-al': { lat: 34.5887, lng: -86.4558 },
    'hartselle-al': { lat: 34.4437, lng: -86.9353 },
    'cullman-al': { lat: 34.1748, lng: -86.8436 },
    'moulton-al': { lat: 34.4812, lng: -87.2953 },
    'florence-al': { lat: 34.7998, lng: -87.6772 },
    'albertville-al': { lat: 34.2673, lng: -86.2088 },
    'guntersville-al': { lat: 34.3582, lng: -86.2947 },
    'arab-al': { lat: 34.3282, lng: -86.4961 },
    'scottsboro-al': { lat: 34.6723, lng: -86.0341 },
    'fort-payne-al': { lat: 34.4443, lng: -85.7197 },
    'muscle-shoals-al': { lat: 34.7448, lng: -87.6675 },
    'meridianville-al': { lat: 34.8512, lng: -86.5722 },
    'hazel-green-al': { lat: 34.9312, lng: -86.5722 },
    'priceville-al': { lat: 34.5254, lng: -86.8947 },
    'somerville-al': { lat: 34.4715, lng: -86.7914 },
    'north-alabama': { lat: 34.6059, lng: -86.9833 },
    'birmingham-al': { lat: 33.5207, lng: -86.8025 },
    'nashville-tn': { lat: 36.1627, lng: -86.7816 },
  };

  const coords = geoCoords[slug] || { lat: 34.6059, lng: -86.9833 };

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "RoofingContractor",
    "name": `River City Roofing Solutions - ${area.name}`,
    "image": `${siteConfig.url}/logo.png`,
    "@id": `${siteConfig.url}/service-areas/${slug}`,
    "url": `${siteConfig.url}/service-areas/${slug}`,
    "telephone": siteConfig.phoneTel,
    "priceRange": "$$",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": siteConfig.address.streetAddress,
      "addressLocality": siteConfig.address.addressLocality,
      "addressRegion": siteConfig.address.addressRegion,
      "postalCode": siteConfig.address.postalCode,
      "addressCountry": siteConfig.address.addressCountry,
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": coords.lat,
      "longitude": coords.lng,
    },
    "areaServed": {
      "@type": area.name.includes('Territory') ? "State" : "City",
      "name": area.name.replace(' Territory', ''),
      "address": {
        "@type": "PostalAddress",
        "addressLocality": area.name.replace('General ', '').replace(' Territory', ''),
        "addressRegion": area.state,
      },
    },
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "opens": "08:00",
        "closes": "17:00",
      },
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "5.0",
      "reviewCount": "47",
      "bestRating": "5",
      "worstRating": "1",
    },
  };

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Service Areas', url: '/service-areas' },
    { name: area.name, url: `/service-areas/${slug}` },
  ]);

  // Dynamic FAQs based on area — use customFAQs if available, otherwise generate generic ones
  const genericFAQs = [
    {
      question: `Do you offer free roof inspections in ${area.name}?`,
      answer: `Yes! River City Roofing Solutions provides completely free, no-obligation roof inspections for homeowners in ${area.name}, ${area.state}. Our certified inspectors will assess your roof's condition, document any issues with photos, and provide honest recommendations.`,
    },
    {
      question: `How quickly can you respond to storm damage in ${area.name}?`,
      answer: `Our response time for ${area.name} is typically ${area.responseTime || 'same day to 2 business days'}. For emergency storm damage, we offer 24/7 service with same-day tarping available to prevent further damage to your home.`,
    },
    {
      question: `What roofing services do you provide in ${area.name}, ${area.state}?`,
      answer: `We provide ${area.services} in ${area.name}. This includes roof replacement, roof repair, storm and hail damage restoration, chimney services, LeafX gutter protection, attic ventilation, and free roof inspections. We also handle insurance claims from start to finish.`,
    },
    {
      question: `How much does a new roof cost in ${area.name}?`,
      answer: `Roof replacement costs in ${area.name} typically range from $5,000 to $25,000+ depending on roof size, materials chosen, and complexity. We offer free detailed quotes so you know exactly what to expect. Many customers qualify for insurance coverage for storm damage.`,
    },
    {
      question: `Do you help with insurance claims in ${area.name}?`,
      answer: `Absolutely! We have extensive experience working with insurance companies on storm and hail damage claims in ${area.name} and throughout ${area.state}. We handle all documentation, photos, and communication with your insurance adjuster to maximize your claim.`,
    },
  ];
  const areaFAQs = area.customFAQs && area.customFAQs.length > 0
    ? [...area.customFAQs, ...genericFAQs.slice(0, 2)]
    : genericFAQs;

  const faqSchema = generateFAQSchema(areaFAQs);

  return (
    <div className="min-h-screen">
      <StructuredData data={[localBusinessSchema, breadcrumbSchema, faqSchema]} />
      <section className="relative min-h-[60vh] flex items-center">
        {area.image && (
          <div className="absolute inset-0 z-0">
            <Image src={area.image} alt={area.altText || area.name + ' roofing services'} fill className="object-cover" priority />
            <div className="absolute inset-0 bg-black/60" />
          </div>
        )}
        <div className="container mx-auto px-4 relative z-10">
          <Link href="/service-areas" className="inline-flex items-center gap-2 text-white/80 hover:text-brand-green mb-6 transition-colors">
            <ArrowLeft size={20} /> All Service Areas
          </Link>
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-brand-green/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <MapPin className="text-brand-green" size={32} />
              </div>
              <span className={"px-4 py-2 backdrop-blur-sm rounded-full font-semibold " + (area.status === 'Active' ? "bg-brand-green/20 text-brand-green" : "bg-yellow-500/20 text-yellow-400")}>
                {area.status === 'Active' ? 'Now Serving' : 'Coming Soon'}
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">Roofing Services in {area.name}, {area.state}</h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl drop-shadow-md">{area.description || area.coverage}</p>
            {area.responseTime && (
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-6 py-3">
                <Clock className="text-brand-green" size={24} />
                <span className="text-white">Response Time: <strong className="text-brand-green">{area.responseTime}</strong></span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold text-white mb-8">Area Details</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                  <span className="text-gray-300">Coverage: {area.coverage}</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                  <span className="text-gray-300">Services: {area.services}</span>
                </div>
                {area.keyDetails && area.keyDetails.map((detail, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-300">{detail}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white mb-8">Services Available</h2>
              <div className="space-y-4">
                {services.map((service) => {
                  const Icon = iconMap[service.icon];
                  return (
                    <Link key={service.id} href={'/services/' + service.slug} className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl hover:border-brand-green/50 transition-colors group">
                      {Icon && <div className="w-12 h-12 bg-brand-blue/20 rounded-full flex items-center justify-center"><Icon className="text-brand-blue" size={24} /></div>}
                      <div>
                        <h3 className="text-white font-semibold group-hover:text-brand-green transition-colors">{service.title}</h3>
                        <p className="text-gray-400 text-sm">{service.costRange || 'Contact for quote'}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Google Map Section */}
      <section className="py-12 md:py-16 bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">Find Us in {area.name}</h2>
            <div className="rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
              <iframe
                src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d105126.23!2d-86.7483!3d34.6993!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2s${encodeURIComponent(area.mapQuery || area.name + ', ' + area.state)}!5e0!3m2!1sen!2sus`}
                width="100%"
                height="450"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Map of ${area.name}, ${area.state}`}
              />
            </div>
            <div className="mt-6 text-center">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${area.mapQuery || area.name + ',+' + area.state}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-brand-green hover:text-lime-400 transition-colors"
              >
                <MapPin size={20} />
                Open in Google Maps
                <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
              Frequently Asked Questions About Roofing in {area.name}
            </h2>
            <div className="space-y-4">
              {areaFAQs.map((faq, idx) => (
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

      {/* Internal Links Section */}
      <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              Explore Our Roofing Services & Other Areas
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-brand-green mb-3">Our Services</h3>
                <ul className="space-y-2">
                  <li><Link href="/services/residential-roof-replacement" className="text-gray-300 hover:text-brand-green transition-colors">Residential Roof Replacement</Link></li>
                  <li><Link href="/services/residential-roof-repair" className="text-gray-300 hover:text-brand-green transition-colors">Roof Repair Services</Link></li>
                  <li><Link href="/services/storm-hail-damage-repair" className="text-gray-300 hover:text-brand-green transition-colors">Storm & Hail Damage Repair</Link></li>
                  <li><Link href="/services/leafx-gutter-protection" className="text-gray-300 hover:text-brand-green transition-colors">LeafX® Gutter Protection</Link></li>
                  <li><Link href="/services" className="text-brand-green font-semibold hover:text-lime-400 transition-colors">View All Services →</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-brand-green mb-3">Other Service Areas</h3>
                <ul className="space-y-2">
                  {['decatur-al', 'huntsville-al', 'madison-al', 'athens-al', 'hartselle-al', 'cullman-al', 'albertville-al', 'guntersville-al', 'scottsboro-al', 'fort-payne-al', 'muscle-shoals-al', 'meridianville-al', 'hazel-green-al', 'priceville-al', 'arab-al', 'somerville-al'].filter(s => s !== slug).slice(0, 5).map(areaSlug => {
                    const areaName = areaSlug.replace('-al', '').replace('-tn', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    return (
                      <li key={areaSlug}><Link href={`/service-areas/${areaSlug}`} className="text-gray-300 hover:text-brand-green transition-colors">Roofing in {areaName}, AL</Link></li>
                    );
                  })}
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
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Get a Free Inspection in {area.name}</h2>
          <p className="text-xl text-blue-100 mb-8">Contact us today for a free roof inspection and quote.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact" className="inline-flex items-center justify-center gap-2 bg-brand-green text-black font-bold px-8 py-4 rounded-full hover:bg-lime-400 transition-colors">
              Schedule Inspection <ArrowRight size={20} />
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

// Trigger Vercel rebuild
