import type { Metadata } from 'next';
import { generateBreadcrumbSchema } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';

export const metadata: Metadata = {
  title: 'Roofing Sales Jobs Decatur & Huntsville AL | Careers at River City Roofing',
  description:
    'Join River City Roofing Solutions in Decatur & Huntsville AL. Roofing sales jobs with unlimited earning potential ($60K-$200K+), free training, flexible schedule. No experience needed. Apply today!',
  openGraph: {
    title: 'Careers — River City Roofing Solutions',
    description:
      'Take control of your future. Unlimited earnings, free training, and a family-oriented team. Calculate your potential income and apply now.',
    url: 'https://www.rivercityroofingsolutions.com/careers',
    siteName: 'River City Roofing Solutions',
    type: 'website',
    images: [
      {
        url: 'https://www.rivercityroofingsolutions.com/og-careers.jpg',
        width: 1200,
        height: 630,
        alt: 'Join River City Roofing Solutions — Build Your Own Business',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Careers — River City Roofing Solutions',
    description:
      'Build your own roofing business. Unlimited earnings, free training, flexible schedule. Apply today!',
  },
  alternates: {
    canonical: 'https://www.rivercityroofingsolutions.com/careers',
  },
};

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  const jobPostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: 'Roofing Sales Representative',
    description:
      'Build your own roofing business with River City Roofing Solutions. Unlimited earning potential with 1099 independent contractor opportunity. No experience needed — free training provided.',
    datePosted: '2025-01-01',
    validThrough: '2026-12-31',
    employmentType: 'CONTRACTOR',
    hiringOrganization: {
      '@type': 'Organization',
      name: 'River City Roofing Solutions',
      sameAs: 'https://www.rivercityroofingsolutions.com',
      logo: 'https://www.rivercityroofingsolutions.com/logo.png',
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Decatur',
        addressRegion: 'AL',
        postalCode: '35603',
        addressCountry: 'US',
      },
    },
    baseSalary: {
      '@type': 'MonetaryAmount',
      currency: 'USD',
      value: {
        '@type': 'QuantitativeValue',
        minValue: 60000,
        maxValue: 200000,
        unitText: 'YEAR',
      },
    },
    jobBenefits: 'Flexible schedule, unlimited earning potential, free training, family-oriented team',
    qualifications: 'No experience required. Must be motivated and willing to learn.',
  };

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Careers', url: '/careers' },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingSchema) }}
      />
      <StructuredData data={breadcrumbSchema} />
      {children}
    </>
  );
}
