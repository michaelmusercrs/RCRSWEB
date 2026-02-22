import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { getLandingPageConfig, landingPages } from '@/lib/landing-pages';
import LandingPageClient from './LandingPageClient';

interface Props {
  params: Promise<{ slug: string }>;
}

// Check if slug is a portal short code (uppercase alphanumeric, typically 6-8 chars)
async function tryShortCodeRedirect(slug: string): Promise<boolean> {
  try {
    const { leadPortalService } = await import('@/lib/lead-portal-service');
    const lead = await leadPortalService.getLeadByShortCode(slug.toUpperCase());
    if (lead) {
      await leadPortalService.recordPortalView(lead.accessToken);
      redirect(`/my/${lead.accessToken}`);
    }
  } catch (e: any) {
    // redirect() throws a NEXT_REDIRECT error — rethrow it
    if (e?.digest?.startsWith('NEXT_REDIRECT')) throw e;
    // Otherwise, short code lookup failed — fall through to landing page
  }
  return false;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const config = getLandingPageConfig(slug);

  return {
    title: config.title,
    description: config.subheadline,
    robots: { index: false, follow: false },
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

  // First, check if this is a portal short code redirect
  if (!(slug in landingPages)) {
    await tryShortCodeRedirect(slug);
    // If we get here, it wasn't a valid short code either
    notFound();
  }

  const config = getLandingPageConfig(slug);
  return <LandingPageClient config={config} />;
}
