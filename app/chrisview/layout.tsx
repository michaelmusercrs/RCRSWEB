import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import ChrisAskWidget from '@/components/ChrisAskWidget';

const inter = Inter({ subsets: ['latin'], adjustFontFallback: false });

export const metadata: Metadata = {
  title: 'RCRS Database — Chris View',
  description: 'River City Roofing Solutions — full data view',
  robots: { index: false, follow: false },
};

export default function ChrisViewLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black text-white`}>
        {children}
        <ChrisAskWidget />
      </body>
    </html>
  );
}
