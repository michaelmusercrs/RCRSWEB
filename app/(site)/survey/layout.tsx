import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Customer Survey | River City Roofing Solutions',
  description: 'Share your feedback about your experience with River City Roofing Solutions.',
  robots: { index: false, follow: false },
};

export default function SurveyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
