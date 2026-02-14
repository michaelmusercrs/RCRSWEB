import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

// Honeypot page — bots that ignore robots.txt end up here
// Triggers email alert then redirects to homepage

export default async function SecretDealsPage() {
  const headersList = headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ua = headersList.get('user-agent') || 'none';

  // Fire and forget the honeypot alert
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  fetch(`${baseUrl}/api/honeypot?src=secret-deals&ip=${encodeURIComponent(ip)}&ua=${encodeURIComponent(ua.slice(0, 100))}`)
    .catch(() => {});

  redirect('/');
}
