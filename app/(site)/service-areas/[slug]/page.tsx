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

// SEO-optimized unique meta descriptions per service area
const areaMetaMap: Record<string, { title: string; description: string; keywords: string[] }> = {
  'decatur-al': {
    title: 'Roofing Contractor Decatur AL | Roof Replacement & Repair',
    description: 'Top-rated roofing contractor in Decatur, AL. Roof replacement, storm damage repair, free inspections & insurance claim assistance. Same-day service from our Decatur headquarters. BBB A+ rated. Call (256) 274-8530.',
    keywords: ['roofing contractor Decatur AL', 'roof replacement Decatur AL', 'roof repair Decatur AL', 'best roofer Decatur AL', 'storm damage Decatur AL', 'free roof inspection Decatur AL', 'roofer near me Decatur'],
  },
  'huntsville-al': {
    title: 'Roofing Contractor Huntsville AL | Roof Replacement & Storm Damage',
    description: 'Trusted roofing contractor in Huntsville, AL. Expert roof replacement, hail damage repair, metal roofing & free inspections. IKO ROOFPRO & Owens Corning certified, serving Madison County. Call (256) 274-8530.',
    keywords: ['roofing contractor Huntsville AL', 'roof replacement Huntsville AL', 'roof repair Huntsville AL', 'best roofer Huntsville AL', 'hail damage Huntsville AL', 'free roof inspection Huntsville', 'metal roofing Huntsville AL'],
  },
  'madison-al': {
    title: 'Roofing Contractor Madison AL | Roof Replacement & Gutter Guards',
    description: 'Professional roofing services in Madison, AL. Residential roof replacement, LeafX gutter guards, storm damage repair & free inspections. Serving Madison\'s growing neighborhoods. Call (256) 274-8530.',
    keywords: ['roofing contractor Madison AL', 'roof replacement Madison AL', 'roof repair Madison AL', 'best roofer Madison AL', 'gutter guards Madison AL', 'free roof inspection Madison AL', 'storm damage Madison'],
  },
  'athens-al': {
    title: 'Roofing Contractor Athens AL | Roof Replacement & Repair',
    description: 'Licensed roofing contractor serving Athens & Limestone County, AL. Roof replacement, storm damage repair, insurance claims & free inspections for historic and modern homes. Call (256) 274-8530.',
    keywords: ['roofing contractor Athens AL', 'roof replacement Athens AL', 'roof repair Athens AL', 'best roofer Athens AL', 'Limestone County roofer', 'free roof inspection Athens AL', 'storm damage Athens'],
  },
  'owens-crossroads-al': {
    title: 'Roofing Services Owens Cross Roads & Hampton Cove AL',
    description: 'Expert roofing services for Owens Cross Roads & Hampton Cove, AL. Mountain and foothill homes need specialized storm protection. Roof replacement, repairs & free inspections. Call (256) 274-8530.',
    keywords: ['roofer Owens Cross Roads AL', 'roofing Hampton Cove AL', 'roof replacement Owens Cross Roads', 'storm damage Hampton Cove', 'free roof inspection Owens Cross Roads AL'],
  },
  'hartselle-al': {
    title: 'Roofing Contractor Hartselle AL | Roof Replacement & Storm Repair',
    description: 'Trusted roofing contractor in Hartselle, AL. Same-day service for roof replacement, storm damage repair & free inspections. Serving Morgan County homeowners. Call (256) 274-8530 today.',
    keywords: ['roofing contractor Hartselle AL', 'roof replacement Hartselle AL', 'roof repair Hartselle AL', 'best roofer Hartselle AL', 'Morgan County roofer', 'free roof inspection Hartselle AL'],
  },
  'cullman-al': {
    title: 'Roofing Contractor Cullman AL | Roof Replacement & Hail Damage',
    description: 'Professional roofing contractor in Cullman, AL. Expert roof replacement, hail & tornado damage repair, commercial roofing & free inspections for Cullman County. Call (256) 274-8530.',
    keywords: ['roofing contractor Cullman AL', 'roof replacement Cullman AL', 'roof repair Cullman AL', 'best roofer Cullman AL', 'Cullman County roofer', 'hail damage Cullman AL', 'free roof inspection Cullman'],
  },
  'moulton-al': {
    title: 'Roofing Contractor Moulton AL | Lawrence County Roof Repair',
    description: 'Reliable roofing services in Moulton & Lawrence County, AL. Roof replacement, storm damage repair, emergency tarping & free inspections. Personalized service for rural and residential properties. Call (256) 274-8530.',
    keywords: ['roofing contractor Moulton AL', 'roof replacement Moulton AL', 'roof repair Moulton AL', 'Lawrence County roofer', 'free roof inspection Moulton AL', 'storm damage Moulton AL'],
  },
  'florence-al': {
    title: 'Roofing Contractor Florence AL | Shoals Area Roof Replacement',
    description: 'Expert roofing contractor serving Florence, Muscle Shoals, Sheffield & Tuscumbia AL. Roof replacement, storm damage repair & insurance claims for Lauderdale County. Free inspections. Call (256) 274-8530.',
    keywords: ['roofing contractor Florence AL', 'roof replacement Florence AL', 'roofer Muscle Shoals AL', 'Shoals area roofer', 'Lauderdale County roofing', 'free roof inspection Florence AL', 'storm damage Florence'],
  },
  'north-alabama': {
    title: 'North Alabama Roofing Contractor | Serving the Entire Region',
    description: 'River City Roofing Solutions serves all of North Alabama with expert roof replacement, storm damage repair & insurance claims. Tornado alley specialists with free inspections territory-wide. Call (256) 274-8530.',
    keywords: ['North Alabama roofing contractor', 'roofing company North Alabama', 'best roofer North Alabama', 'storm damage North Alabama', 'hail damage repair Alabama', 'free roof inspection North Alabama'],
  },
  'birmingham-al': {
    title: 'Roofing Contractor Birmingham AL | Coming Soon',
    description: 'River City Roofing Solutions is expanding to Birmingham, AL in 2026. Bringing our trusted roof replacement, storm damage repair & insurance claim services to Alabama\'s largest metro. Call (256) 274-8530.',
    keywords: ['roofing contractor Birmingham AL', 'roof replacement Birmingham AL', 'roofer Birmingham AL', 'storm damage Birmingham', 'new roofing company Birmingham'],
  },
  'nashville-tn': {
    title: 'Roofing Contractor Nashville TN | Coming Soon',
    description: 'River City Roofing Solutions is expanding to Nashville, TN in 2026. Commercial and residential roofing, storm damage repair & insurance claim expertise coming to Music City. Call (256) 274-8530.',
    keywords: ['roofing contractor Nashville TN', 'roof replacement Nashville TN', 'roofer Nashville TN', 'storm damage Nashville', 'new roofing company Nashville'],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const area = getServiceArea(slug);
  if (!area) return { title: 'Area Not Found' };

  const path = `/service-areas/${slug}`;
  const meta = areaMetaMap[slug];

  const title = meta?.title || `${area.name} AL Roofing Contractor | Roof Replacement & Repair`;
  const description = meta?.description || `Professional roofing contractor in ${area.name}, ${area.state}. Roof replacement, storm damage repair, free inspections & insurance claims. Call (256) 274-8530.`;
  const keywords = meta?.keywords || [`roofing contractor ${area.name} ${area.state}`, `roof replacement ${area.name} ${area.state}`, `best roofer ${area.name} ${area.state}`];

  const ogImageUrl = `${siteConfig.url}/og-image.png`;

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
    'north-alabama': { lat: 34.6059, lng: -86.9833 },
    'birmingham-al': { lat: 33.5207, lng: -86.8025 },
    'nashville-tn': { lat: 36.1627, lng: -86.7816 },
  };

  const coords = geoCoords[slug] || { lat: 34.6059, lng: -86.9833 };

  // Service types we offer in every area — fed to schema as both serviceType
  // string array AND as an OfferCatalog so search engines understand the
  // catalog of work, not just a generic "roofing" label.
  const serviceTypes = [
    'Roof Replacement',
    'Roof Repair',
    'Storm Damage Repair',
    'Hail Damage Inspection',
    'Insurance Claim Assistance',
    'Gutter Installation',
    'Gutter Guards (LeafX)',
    'Chimney Repair',
    'Attic Ventilation',
    'Free Roof Inspection',
  ];

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "RoofingContractor",
    "name": `River City Roofing Solutions - ${area.name}`,
    "image": `${siteConfig.url}/logo.png`,
    "@id": `${siteConfig.url}/service-areas/${slug}`,
    "url": `${siteConfig.url}/service-areas/${slug}`,
    "telephone": siteConfig.phoneTel,
    "priceRange": "$$ — Free inspections, $5,000–$25,000+ replacements",
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
    "serviceType": serviceTypes,
    // Discoverability boost: every service we offer in this city, listed as
    // an Offer with explicit Service typing. Google uses this to populate
    // local pack rich results and "services offered" cards.
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": `Roofing Services in ${area.name}`,
      "itemListElement": serviceTypes.map((s) => ({
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": s,
          "areaServed": area.name,
          "provider": {
            "@type": "RoofingContractor",
            "name": "River City Roofing Solutions",
          },
        },
      })),
    },
    "paymentAccepted": "Cash, Check, Credit Card, Insurance, Financing, Bitcoin",
    "currenciesAccepted": "USD, BTC",
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
      ...siteConfig.reviewStats,
    },
    "sameAs": [
      "https://www.facebook.com/rivercityroofingsolutions",
      "https://g.page/r/CfEkY1DPAq8TEBM",
    ],
  };

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Service Areas', url: '/service-areas' },
    { name: area.name, url: `/service-areas/${slug}` },
  ]);

  // Dynamic FAQs based on area
  const areaFAQs = [
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
                <h3 className="text-lg font-semibold text-brand-green mb-3">Roofing Services in {area.name}</h3>
                <ul className="space-y-2">
                  <li><Link href="/services/residential-roof-replacement" className="text-gray-300 hover:text-brand-green transition-colors">Roof Replacement in {area.name}</Link></li>
                  <li><Link href="/services/residential-roof-repair" className="text-gray-300 hover:text-brand-green transition-colors">Roof Repair in {area.name}</Link></li>
                  <li><Link href="/services/storm-hail-damage-repair" className="text-gray-300 hover:text-brand-green transition-colors">Storm &amp; Hail Damage Repair</Link></li>
                  <li><Link href="/services/commercial-roofing" className="text-gray-300 hover:text-brand-green transition-colors">Commercial Roofing</Link></li>
                  <li><Link href="/services/emergency-roof-services" className="text-gray-300 hover:text-brand-green transition-colors">Emergency Roof Services</Link></li>
                  <li><Link href="/services/leafx-gutter-protection" className="text-gray-300 hover:text-brand-green transition-colors">LeafX Gutter Protection</Link></li>
                  <li><Link href="/services/chimney-services" className="text-gray-300 hover:text-brand-green transition-colors">Chimney Services</Link></li>
                  <li><Link href="/services/roof-inspections-maintenance" className="text-gray-300 hover:text-brand-green transition-colors">Free Roof Inspection</Link></li>
                  <li><Link href="/services" className="text-brand-green font-semibold hover:text-lime-400 transition-colors">View All Services →</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-brand-green mb-3">Also Serving Nearby Areas</h3>
                <ul className="space-y-2">
                  {[
                    { slug: 'decatur-al', name: 'Decatur', state: 'AL' },
                    { slug: 'huntsville-al', name: 'Huntsville', state: 'AL' },
                    { slug: 'madison-al', name: 'Madison', state: 'AL' },
                    { slug: 'athens-al', name: 'Athens', state: 'AL' },
                    { slug: 'hartselle-al', name: 'Hartselle', state: 'AL' },
                    { slug: 'cullman-al', name: 'Cullman', state: 'AL' },
                    { slug: 'moulton-al', name: 'Moulton', state: 'AL' },
                    { slug: 'florence-al', name: 'Florence', state: 'AL' },
                    { slug: 'owens-crossroads-al', name: 'Owens Cross Roads', state: 'AL' },
                    { slug: 'albertville-al', name: 'Albertville', state: 'AL' },
                    { slug: 'guntersville-al', name: 'Guntersville', state: 'AL' },
                    { slug: 'scottsboro-al', name: 'Scottsboro', state: 'AL' },
                    { slug: 'fort-payne-al', name: 'Fort Payne', state: 'AL' },
                    { slug: 'muscle-shoals-al', name: 'Muscle Shoals', state: 'AL' },
                    { slug: 'meridianville-al', name: 'Meridianville', state: 'AL' },
                    { slug: 'priceville-al', name: 'Priceville', state: 'AL' },
                  ].filter(a => a.slug !== slug).slice(0, 6).map(nearbyArea => (
                    <li key={nearbyArea.slug}><Link href={`/service-areas/${nearbyArea.slug}`} className="text-gray-300 hover:text-brand-green transition-colors">Roofing Contractor in {nearbyArea.name}, {nearbyArea.state}</Link></li>
                  ))}
                  <li><Link href="/service-areas" className="text-brand-green font-semibold hover:text-lime-400 transition-colors">View All Service Areas →</Link></li>
                </ul>
              </div>
            </div>
            <div className="mt-6 text-center space-y-2">
              <p className="text-gray-400 text-sm">
                Read our <Link href="/blog" className="text-brand-green hover:text-lime-400">roofing blog</Link> for expert tips on roof maintenance, storm preparation and choosing the right materials.
              </p>
              <p className="text-gray-400 text-sm">
                <Link href="/check-my-address" className="text-brand-green hover:text-lime-400">Check your address</Link> for recent hail and storm activity, or <Link href="/contact" className="text-brand-green hover:text-lime-400">contact us</Link> for a free roof inspection in {area.name}.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-brand-blue">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Get a Free Inspection in {area.name}</h2>
          <p className="text-xl text-blue-50 mb-8">Contact us today for a free roof inspection and quote.</p>
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
