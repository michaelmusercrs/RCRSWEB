import { generateMetadata as genMeta } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = genMeta({
  title: 'Contact Us | Free Roof Inspection Decatur & Huntsville AL',
  description: 'Contact River City Roofing Solutions for a free, no-obligation roof inspection in Decatur, Huntsville, Madison & Athens AL. Get a same-day quote for roof replacement, storm damage repair or emergency service. Call (256) 274-8530.',
  path: '/contact',
  keywords: ['contact roofer Decatur AL', 'free roof inspection North Alabama', 'free roof inspection Huntsville AL', 'roofing quote Decatur AL', 'schedule roof inspection', 'roofing estimate North Alabama'],
});

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
