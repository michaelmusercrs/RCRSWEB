import { Metadata } from 'next';
import { generateMetadata as genMeta, generateContactPageSchema, generateBreadcrumbSchema } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';
import ContactPageClient from './ContactPageClient';

export const metadata: Metadata = genMeta({
  title: 'Contact Us | Free Roof Inspection Decatur & Huntsville AL',
  description: 'Contact River City Roofing Solutions for a free, no-obligation roof inspection in Decatur, Huntsville, Madison & Athens AL. Get a same-day quote for roof replacement, storm damage repair or emergency service. Call (256) 274-8530 today.',
  keywords: ['contact roofer Decatur AL', 'free roof inspection North Alabama', 'free roof inspection Huntsville AL', 'roofing quote Decatur AL', 'schedule roof inspection', 'roofing estimate North Alabama', 'emergency roofer phone number', 'storm damage inspection Alabama'],
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
