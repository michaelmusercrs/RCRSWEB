import { Metadata } from 'next';
import DashboardClient from './DashboardClient';
import { generateMetadata as generateSEO } from '@/lib/seo';

export const metadata: Metadata = generateSEO({
  title: 'Lead Management Dashboard',
  description: 'Business intelligence dashboard for tracking leads, conversions, and revenue.',
  noindex: true, // Private page
  path: '/dashboard',
});

export default function DashboardPage() {
  return <DashboardClient />;
}
