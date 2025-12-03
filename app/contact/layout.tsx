import { generateMetadata as genMeta } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = genMeta({
  title: 'Contact Us - Free Roof Inspection',
  description: 'Contact River City Roofing Solutions for a free roof inspection in Decatur, Huntsville, Madison & North Alabama. Call (256) 274-8530 or fill out our form.',
  path: '/contact',
  keywords: ['contact roofer', 'free roof inspection', 'roofing quote', 'North Alabama roofing'],
});

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
