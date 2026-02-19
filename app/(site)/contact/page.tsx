import { Metadata } from 'next';
import { generateMetadata as genMeta, generateContactPageSchema, generateBreadcrumbSchema } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';
import ContactPageClient from './ContactPageClient';

export const metadata: Metadata = genMeta({
  title: 'Contact Us - Free Roof Inspection in North Alabama',
  description: 'Contact River City Roofing Solutions for a free roof inspection in Decatur, Huntsville, Madison, Athens & North Alabama. Licensed & insured. Call (256) 274-8530 today.',
  keywords: ['contact roofer', 'free roof inspection', 'roofing quote', 'Decatur roofing contact', 'Huntsville roofer contact', 'North Alabama roofing estimate'],
  path: '/contact',
});

export default function ContactPage() {
  const contactSchema = generateContactPageSchema();
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Contact Us', url: '/contact' },
  ]);

  return (
    <>
      <StructuredData data={[contactSchema, breadcrumbSchema]} />
      <ContactPageClient />
    </>
  );
}
