import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';

const inter = Inter({ subsets: ['latin'], adjustFontFallback: false });

export const metadata: Metadata = {
  title: 'RCRS Division Leader Checks',
  description: 'Recruiter / division-leader override commission history',
  robots: { index: false, follow: false },
};

export default function DivisionLeadersLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black text-white`}>{children}</body>
    </html>
  );
}
