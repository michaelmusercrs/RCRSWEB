import type { Metadata } from 'next';
import { getLandingPageConfig, landingPages } from '@/lib/landing-pages';
import LandingPageClient from './LandingPageClient';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const config = getLandingPageConfig(slug);

  return {
    title: config.title,
    description: config.subheadline,
    robots: { index: false, follow: false }, // Landing pages shouldn't be indexed
    openGraph: {
      title: config.headline,
      description: config.subheadline,
      type: 'website',
    },
  };
}

export function generateStaticParams() {
  return Object.keys(landingPages).map(slug => ({ slug }));
}

export default async function LandingPage({ params }: Props) {
  const { slug } = await params;
  const config = getLandingPageConfig(slug);

  return <LandingPageClient config={config} />;
}
