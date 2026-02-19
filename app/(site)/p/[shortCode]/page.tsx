// Short URL Redirect Page
// Redirects /p/[shortCode] to full portal URL

import { redirect, notFound } from 'next/navigation';
import { leadPortalService } from '@/lib/lead-portal-service';

interface PageProps {
  params: Promise<{
    shortCode: string;
  }>;
}

export default async function ShortCodeRedirect({ params }: PageProps) {
  const { shortCode } = await params;

  if (!shortCode) {
    notFound();
  }

  // Look up the lead by short code
  const lead = await leadPortalService.getLeadByShortCode(shortCode.toUpperCase());

  if (!lead) {
    notFound();
  }

  // Record the portal view
  await leadPortalService.recordPortalView(lead.accessToken);

  // Redirect to the full portal URL
  redirect(`/my/${lead.accessToken}`);
}

// Generate metadata for the page (in case redirect takes a moment)
export async function generateMetadata({ params }: PageProps) {
  const { shortCode } = await params;

  return {
    title: 'Redirecting... | River City Roofing Solutions',
    description: 'Redirecting to your customer portal.',
    robots: {
      index: false,
      follow: false,
    },
  };
}
