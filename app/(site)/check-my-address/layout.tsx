import { Metadata } from 'next';
import { generateBreadcrumbSchema } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';

export const metadata: Metadata = {
  title: 'Check My Address for Hail & Storm Damage | Free Report | River City Roofing',
  description:
    'Free instant hail and storm damage report for your property in Decatur, Huntsville & North Alabama. See real NWS data about recent storms near your address. No obligation. Call (256) 274-8530.',
  keywords: [
    'hail damage report my address',
    'storm damage check Alabama',
    'free roof inspection Decatur AL',
    'free roof inspection Huntsville AL',
    'hail damage Decatur AL',
    'hail damage Huntsville AL',
    'storm damage North Alabama',
    'check my roof for hail damage',
    'free storm damage assessment',
    'hail damage report near me',
    'roof damage check free',
  ],
  openGraph: {
    title: 'Storm Check | Free Storm Damage Report | River City Roofing Solutions',
    description:
      'Free instant storm report for your address. See real hail data from the National Weather Service and find out if your roof may be at risk.',
    type: 'website',
    url: 'https://www.rivercityroofingsolutions.com/check-my-address',
    siteName: 'River City Roofing Solutions',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Check Your Address for Storm Damage Risk',
    description:
      'Get a free hail and storm damage report for your property. Instant results using real NWS data.',
  },
  alternates: {
    canonical: 'https://www.rivercityroofingsolutions.com/check-my-address',
  },
};

export default function CheckMyAddressLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': 'https://www.rivercityroofingsolutions.com/check-my-address',
        url: 'https://www.rivercityroofingsolutions.com/check-my-address',
        name: 'Check Your Address for Storm Damage Risk | River City Roofing Solutions',
        description:
          'Get a free hail and storm damage report for your property. See real National Weather Service data about recent storms near your address.',
        isPartOf: {
          '@type': 'WebSite',
          '@id': 'https://www.rivercityroofingsolutions.com',
          name: 'River City Roofing Solutions',
        },
        inLanguage: 'en-US',
      },
      {
        '@type': 'Service',
        '@id': 'https://www.rivercityroofingsolutions.com/check-my-address#service',
        name: 'Free Storm Damage Risk Report',
        description:
          'Free instant storm and hail damage risk assessment for your property using real National Weather Service data. Includes recent hail reports, active weather alerts, and personalized risk assessment.',
        provider: {
          '@type': 'RoofingContractor',
          name: 'River City Roofing Solutions',
          telephone: '+1-256-274-8530',
          email: 'rcrs@rivercityroofingsolutions.com',
          url: 'https://www.rivercityroofingsolutions.com',
          address: {
            '@type': 'PostalAddress',
            streetAddress: '3325 Central Pkwy SW',
            addressLocality: 'Decatur',
            addressRegion: 'AL',
            postalCode: '35603',
            addressCountry: 'US',
          },
          areaServed: [
            { '@type': 'City', name: 'Huntsville', containedInPlace: { '@type': 'State', name: 'Alabama' } },
            { '@type': 'City', name: 'Birmingham', containedInPlace: { '@type': 'State', name: 'Alabama' } },
            { '@type': 'City', name: 'Nashville', containedInPlace: { '@type': 'State', name: 'Tennessee' } },
            { '@type': 'City', name: 'Chattanooga', containedInPlace: { '@type': 'State', name: 'Tennessee' } },
            { '@type': 'City', name: 'Memphis', containedInPlace: { '@type': 'State', name: 'Tennessee' } },
          ],
        },
        serviceType: 'Storm Damage Assessment',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          description: 'Free storm damage risk report - no obligation',
        },
      },
    ],
  };

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Check My Address', url: '/check-my-address' },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StructuredData data={breadcrumbSchema} />
      {children}
    </>
  );
}
