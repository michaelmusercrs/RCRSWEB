import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BNI Portal Demo | River City Roofing Solutions',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
