/**
 * SEO Utilities and Metadata Helpers
 * Comprehensive SEO system for River City Roofing Solutions
 */

import { Metadata } from 'next';

// Base configuration
export const siteConfig = {
  name: 'River City Roofing Solutions',
  description: 'Licensed and insured roofing contractor serving Decatur, Huntsville, Madison, and all of North Alabama. Expert roof replacement, repair, and storm damage services.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://rivercityroofingsolutions.com',
  ogImage: '/og-image.jpg',
  phone: '256-274-8530',
  email: 'office@rcrsal.com',
  address: {
    streetAddress: '',
    addressLocality: 'Decatur',
    addressRegion: 'AL',
    postalCode: '',
    addressCountry: 'US',
  },
  social: {
    facebook: 'https://facebook.com/rivercityroofingsolutions',
    instagram: 'https://instagram.com/rivercityroofingsolutions',
  },
  defaultKeywords: [
    'roofing contractor',
    'North Alabama roofer',
    'Decatur roofing',
    'Huntsville roofing',
    'Madison roofing',
    'roof replacement',
    'roof repair',
    'storm damage',
    'insurance claims',
    'residential roofing',
    'commercial roofing',
  ],
};

interface GenerateMetadataParams {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  path?: string;
  noindex?: boolean;
}

/**
 * Generate comprehensive metadata for any page
 */
export function generateMetadata(params: GenerateMetadataParams = {}): Metadata {
  const {
    title,
    description = siteConfig.description,
    keywords = [],
    image = siteConfig.ogImage,
    type = 'website',
    publishedTime,
    modifiedTime,
    author,
    path = '',
    noindex = false,
  } = params;

  const fullTitle = title
    ? `${title} | ${siteConfig.name}`
    : `${siteConfig.name} | Professional Roofing Services in North Alabama`;

  const url = `${siteConfig.url}${path}`;
  const imageUrl = image.startsWith('http') ? image : `${siteConfig.url}${image}`;

  const allKeywords = [...siteConfig.defaultKeywords, ...keywords];

  const metadata: Metadata = {
    metadataBase: new URL(siteConfig.url),
    title: fullTitle,
    description,
    applicationName: siteConfig.name,
    authors: author ? [{ name: author }] : [{ name: siteConfig.name }],
    generator: 'Next.js',
    referrer: 'origin-when-cross-origin',
    creator: siteConfig.name,
    publisher: siteConfig.name,
    formatDetection: {
      telephone: true,
      email: true,
      address: true,
    },
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: type as any,
      siteName: siteConfig.name,
      title: fullTitle,
      description,
      url,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title || siteConfig.name,
        },
      ],
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [imageUrl],
      creator: '@rivercityroofing',
      site: '@rivercityroofing',
    },
    robots: noindex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
    verification: {
      google: 'your-google-verification-code', // TODO: Add real verification code
      yandex: 'your-yandex-verification-code',
      // Add other verification codes as needed
    },
    other: {
      'google-site-verification': 'your-verification-code',
      'msvalidate.01': 'your-bing-verification-code',
    },
  };

  // Add article-specific metadata
  if (type === 'article' && publishedTime) {
    metadata.openGraph = {
      ...metadata.openGraph,
      type: 'article',
      publishedTime,
      modifiedTime,
      authors: author ? [author] : undefined,
    };
  }

  return metadata;
}

/**
 * Generate JSON-LD structured data for local business
 */
export function generateLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'RoofingContractor',
    '@id': `${siteConfig.url}#organization`,
    name: siteConfig.name,
    alternateName: 'RCRS',
    description: siteConfig.description,
    url: siteConfig.url,
    logo: `${siteConfig.url}/logo.png`,
    image: `${siteConfig.url}/og-image.jpg`,
    telephone: siteConfig.phone,
    email: siteConfig.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: siteConfig.address.addressLocality,
      addressRegion: siteConfig.address.addressRegion,
      addressCountry: siteConfig.address.addressCountry,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 34.6059,
      longitude: -86.9833,
    },
    areaServed: [
      {
        '@type': 'City',
        name: 'Decatur',
        '@id': 'https://en.wikipedia.org/wiki/Decatur,_Alabama',
      },
      {
        '@type': 'City',
        name: 'Huntsville',
        '@id': 'https://en.wikipedia.org/wiki/Huntsville,_Alabama',
      },
      {
        '@type': 'City',
        name: 'Madison',
        '@id': 'https://en.wikipedia.org/wiki/Madison,_Alabama',
      },
      {
        '@type': 'City',
        name: 'Athens',
        '@id': 'https://en.wikipedia.org/wiki/Athens,_Alabama',
      },
      {
        '@type': 'City',
        name: 'Cullman',
        '@id': 'https://en.wikipedia.org/wiki/Cullman,_Alabama',
      },
      {
        '@type': 'State',
        name: 'Alabama',
      },
    ],
    priceRange: '$$$',
    currenciesAccepted: 'USD',
    paymentAccepted: 'Cash, Credit Card, Check, Financing',
    openingHours: 'Mo-Fr 08:00-17:00',
    sameAs: [
      siteConfig.social.facebook,
      siteConfig.social.instagram,
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5.0',
      reviewCount: '47',
      bestRating: '5',
      worstRating: '1',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Roofing Services',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Roof Replacement',
            description: 'Complete roof replacement services for residential and commercial properties',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Roof Repair',
            description: 'Expert roof repair services for all types of roofing systems',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Storm Damage Restoration',
            description: 'Emergency storm damage repair and insurance claim assistance',
          },
        },
      ],
    },
  };
}

/**
 * Generate JSON-LD structured data for organization
 */
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteConfig.url}#organization`,
    name: siteConfig.name,
    url: siteConfig.url,
    logo: {
      '@type': 'ImageObject',
      url: `${siteConfig.url}/logo.png`,
      width: '512',
      height: '512',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: siteConfig.phone,
        contactType: 'customer service',
        areaServed: 'US',
        availableLanguage: ['English'],
      },
    ],
    sameAs: [
      siteConfig.social.facebook,
      siteConfig.social.instagram,
    ],
  };
}

/**
 * Generate JSON-LD structured data for blog posts
 */
export function generateArticleSchema(params: {
  title: string;
  description: string;
  image: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: params.title,
    description: params.description,
    image: params.image.startsWith('http') ? params.image : `${siteConfig.url}${params.image}`,
    datePublished: params.datePublished,
    dateModified: params.dateModified || params.datePublished,
    author: {
      '@type': 'Person',
      name: params.author || siteConfig.name,
    },
    publisher: generateOrganizationSchema(),
    url: params.url,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': params.url,
    },
  };
}

/**
 * Generate JSON-LD structured data for service pages
 */
export function generateServiceSchema(params: {
  name: string;
  description: string;
  image?: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: params.name,
    description: params.description,
    provider: generateOrganizationSchema(),
    areaServed: {
      '@type': 'State',
      name: 'Alabama',
    },
    serviceType: params.name,
    url: params.url,
    ...(params.image && {
      image: params.image.startsWith('http') ? params.image : `${siteConfig.url}${params.image}`,
    }),
  };
}

/**
 * Generate JSON-LD structured data for breadcrumbs
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${siteConfig.url}${item.url}`,
    })),
  };
}

/**
 * Generate FAQ schema for service pages
 */
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate script tag content for JSON-LD structured data
 * Use this in your component with dangerouslySetInnerHTML
 */
export function getStructuredDataScript(data: any): string {
  return JSON.stringify(data);
}
