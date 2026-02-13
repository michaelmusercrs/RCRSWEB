import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Careers | Join River City Roofing Solutions — Build Your Own Business',
  description:
    'Build your own roofing business with River City Roofing Solutions. Unlimited earning potential, free training, flexible schedule. No experience needed. Apply today!',
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
  return <>{children}</>;
}
