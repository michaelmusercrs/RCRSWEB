import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

// Honeypot page — bots that ignore robots.txt end up here

export default async function InternalPricingPage() {
  const headersList = headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ua = headersList.get('user-agent') || 'none';

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  fetch(`${baseUrl}/api/honeypot?src=internal-pricing&ip=${encodeURIComponent(ip)}&ua=${encodeURIComponent(ua.slice(0, 100))}`)
    .catch(() => {});

  redirect('/');
}
