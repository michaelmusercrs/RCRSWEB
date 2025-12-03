import { Metadata } from 'next';
import { generateMetadata as genMeta, siteConfig } from '@/lib/seo';
import ContactPageClient from './ContactPageClient';

export const metadata: Metadata = genMeta({
  title: 'Contact Us - Free Roofing Inspection',
  description: 'Contact River City Roofing Solutions for a free roof inspection. Serving Decatur, Huntsville, Madison and all of North Alabama. Call (256) 274-8530.',
  keywords: ['contact roofer', 'free roof inspection', 'roofing quote', 'Decatur roofing contact'],
  path: '/contact',
});

export default function ContactPage() {
  return <ContactPageClient />;
}
