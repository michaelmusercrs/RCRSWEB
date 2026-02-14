/**
 * SEO Utilities and Metadata Helpers
 * Comprehensive SEO system for River City Roofing Solutions
 */

import { Metadata } from 'next';

// Base configuration - Use www version for canonical URLs
// IMPORTANT: Always use hardcoded www URL for canonical consistency
export const siteConfig = {
  name: 'River City Roofing Solutions',
  shortName: 'RCRS',
  description: 'Licensed and insured roofing contractor serving Decatur, Huntsville, Madison, and all of North Alabama. Expert roof replacement, repair, and storm damage services.',
  url: 'https://www.rivercityroofingsolutions.com', // Hardcoded to ensure consistent canonical URLs
  ogImage: '/logo.png',
  logo: '/logo.png',
  logoSquare: '/logo-square.png',
  phone: '256-274-8530',
  phoneFormatted: '(256) 274-8530',
  phoneTel: '+12562748530',
  email: 'rcrs@rivercityroofingsolutions.com',
  foundingYear: 2010,
  address: {
    streetAddress: '3325 Central Pkwy SW',
    addressLocality: 'Decatur',
    addressRegion: 'AL',
    postalCode: '35603',
    addressCountry: 'US',
  },
  geo: {
    latitude: 34.6059,
    longitude: -86.9833,
  },
  social: {
    facebook: 'https://facebook.com/rivercityroofingsolutions',
    instagram: 'https://instagram.com/rivercityroofingsolutions',
  },
  businessHours: {
    weekdays: 'Mo-Fr 08:00-17:00',
    saturday: 'Sa 09:00-14:00',
    sunday: 'Closed',
  },
  priceRange: '$$',
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
    'free roof inspection',
    'roofing company near me',
  ],
  // Service areas for local SEO
  serviceAreas: [
    'Decatur, AL',
    'Huntsville, AL',
    'Madison, AL',
    'Athens, AL',
    'Cullman, AL',
    'Hartselle, AL',
    'Moulton, AL',
    'Florence, AL',
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
    // Set canonical as absolute URL to ensure correct www domain and full path
    alternates: {
      canonical: `${siteConfig.url}${path || '/'}`,
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
    // Verification codes should be set via environment variables
    // Set GOOGLE_SITE_VERIFICATION, YANDEX_VERIFICATION, BING_VERIFICATION in .env.local
    ...(process.env.GOOGLE_SITE_VERIFICATION || process.env.YANDEX_VERIFICATION ? {
      verification: {
        ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
        ...(process.env.YANDEX_VERIFICATION ? { yandex: process.env.YANDEX_VERIFICATION } : {}),
      },
    } : {}),
    ...(process.env.GOOGLE_SITE_VERIFICATION || process.env.BING_VERIFICATION ? {
      other: {
        ...(process.env.GOOGLE_SITE_VERIFICATION ? { 'google-site-verification': process.env.GOOGLE_SITE_VERIFICATION } : {}),
        ...(process.env.BING_VERIFICATION ? { 'msvalidate.01': process.env.BING_VERIFICATION } : {}),
      },
    } : {}),
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
    image: `${siteConfig.url}/logo.png`,
    telephone: siteConfig.phone,
    email: siteConfig.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: siteConfig.address.streetAddress,
      addressLocality: siteConfig.address.addressLocality,
      addressRegion: siteConfig.address.addressRegion,
      postalCode: siteConfig.address.postalCode,
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
        '@type': 'City',
        name: 'Hartselle',
        '@id': 'https://en.wikipedia.org/wiki/Hartselle,_Alabama',
      },
      {
        '@type': 'City',
        name: 'Florence',
        '@id': 'https://en.wikipedia.org/wiki/Florence,_Alabama',
      },
      {
        '@type': 'City',
        name: 'Moulton',
        '@id': 'https://en.wikipedia.org/wiki/Moulton,_Alabama',
      },
      {
        '@type': 'State',
        name: 'Alabama',
      },
    ],
    priceRange: '$$',
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
    provider: {
      '@type': 'RoofingContractor',
      name: siteConfig.name,
      '@id': `${siteConfig.url}#organization`,
      telephone: siteConfig.phone,
      address: {
        '@type': 'PostalAddress',
        ...siteConfig.address,
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '5.0',
        reviewCount: '47',
        bestRating: '5',
        worstRating: '1',
      },
    },
    areaServed: [
      { '@type': 'City', name: 'Decatur', containedInPlace: { '@type': 'State', name: 'Alabama' } },
      { '@type': 'City', name: 'Huntsville', containedInPlace: { '@type': 'State', name: 'Alabama' } },
      { '@type': 'City', name: 'Madison', containedInPlace: { '@type': 'State', name: 'Alabama' } },
      { '@type': 'City', name: 'Athens', containedInPlace: { '@type': 'State', name: 'Alabama' } },
      { '@type': 'City', name: 'Hartselle', containedInPlace: { '@type': 'State', name: 'Alabama' } },
      { '@type': 'City', name: 'Cullman', containedInPlace: { '@type': 'State', name: 'Alabama' } },
    ],
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

/**
 * Generate WebSite schema for homepage
 */
export function generateWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteConfig.url}/#website`,
    url: siteConfig.url,
    name: siteConfig.name,
    description: siteConfig.description,
    publisher: {
      '@id': `${siteConfig.url}/#organization`,
    },
  };
}

/**
 * Generate Review schema for individual reviews
 */
export function generateReviewSchema(params: {
  reviewBody: string;
  ratingValue: number;
  authorName: string;
  datePublished?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    reviewBody: params.reviewBody,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: params.ratingValue,
      bestRating: 5,
      worstRating: 1,
    },
    author: {
      '@type': 'Person',
      name: params.authorName,
    },
    datePublished: params.datePublished || new Date().toISOString().split('T')[0],
    itemReviewed: {
      '@type': 'RoofingContractor',
      name: siteConfig.name,
      '@id': `${siteConfig.url}/#organization`,
    },
  };
}

/**
 * Generate Person schema for team member pages
 */
export function generatePersonSchema(params: {
  name: string;
  jobTitle: string;
  description?: string;
  image?: string;
  email?: string;
  telephone?: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: params.name,
    jobTitle: params.jobTitle,
    description: params.description,
    image: params.image ? (params.image.startsWith('http') ? params.image : `${siteConfig.url}${params.image}`) : undefined,
    email: params.email,
    telephone: params.telephone,
    url: params.url,
    worksFor: {
      '@type': 'RoofingContractor',
      name: siteConfig.name,
      '@id': `${siteConfig.url}/#organization`,
    },
  };
}

/**
 * Generate HowTo schema for DIY/guide content
 */
export function generateHowToSchema(params: {
  name: string;
  description: string;
  steps: Array<{ name: string; text: string; image?: string }>;
  totalTime?: string;
  estimatedCost?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: params.name,
    description: params.description,
    totalTime: params.totalTime,
    estimatedCost: params.estimatedCost
      ? {
          '@type': 'MonetaryAmount',
          currency: 'USD',
          value: params.estimatedCost,
        }
      : undefined,
    step: params.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      image: step.image ? (step.image.startsWith('http') ? step.image : `${siteConfig.url}${step.image}`) : undefined,
    })),
  };
}

/**
 * Generate ContactPage schema
 */
export function generateContactPageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Contact River City Roofing Solutions',
    description: 'Contact us for a free roof inspection. Serving Decatur, Huntsville, Madison and all of North Alabama.',
    url: `${siteConfig.url}/contact`,
    mainEntity: {
      '@type': 'RoofingContractor',
      '@id': `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      telephone: siteConfig.phoneTel,
      email: siteConfig.email,
      address: {
        '@type': 'PostalAddress',
        ...siteConfig.address,
      },
    },
  };
}

/**
 * Generate AboutPage schema
 */
export function generateAboutPageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `About ${siteConfig.name}`,
    description: `Learn about ${siteConfig.name}, a family-owned roofing company serving North Alabama since ${siteConfig.foundingYear}.`,
    url: `${siteConfig.url}/about`,
    mainEntity: {
      '@type': 'RoofingContractor',
      '@id': `${siteConfig.url}/#organization`,
    },
  };
}

/**
 * Generate CollectionPage schema for listing pages (services, blog, team)
 */
export function generateCollectionPageSchema(params: {
  name: string;
  description: string;
  url: string;
  numberOfItems?: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: params.name,
    description: params.description,
    url: params.url.startsWith('http') ? params.url : `${siteConfig.url}${params.url}`,
    numberOfItems: params.numberOfItems,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: params.numberOfItems,
    },
  };
}

/**
 * Generate VideoObject schema for video content
 */
export function generateVideoSchema(params: {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration?: string;
  contentUrl?: string;
  embedUrl?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: params.name,
    description: params.description,
    thumbnailUrl: params.thumbnailUrl.startsWith('http') ? params.thumbnailUrl : `${siteConfig.url}${params.thumbnailUrl}`,
    uploadDate: params.uploadDate,
    duration: params.duration,
    contentUrl: params.contentUrl,
    embedUrl: params.embedUrl,
    publisher: {
      '@type': 'Organization',
      name: siteConfig.name,
      logo: {
        '@type': 'ImageObject',
        url: `${siteConfig.url}${siteConfig.logo}`,
      },
    },
  };
}

/**
 * Generate complete structured data array for homepage
 * Combines LocalBusiness, Organization, and WebSite schemas
 */
export function generateHomepageStructuredData() {
  return [
    generateLocalBusinessSchema(),
    generateWebSiteSchema(),
  ];
}
