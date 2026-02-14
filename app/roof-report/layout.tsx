import { generateMetadata as genMeta } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = genMeta({
  title: 'Roof Measurement Report Generator',
  description: 'Generate professional roof measurement and material estimate reports with auto-calculated quantities and costs.',
  path: '/roof-report',
});

export default function RoofReportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
