import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import FloatingContactButton from '@/components/FloatingContactButton';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'River City Roofing Solutions | Professional Roofing Services in North Alabama',
  description: 'Licensed and insured roofing contractor serving Decatur, Huntsville, Madison, and all of North Alabama. Expert roof replacement, repair, and storm damage services.',
  keywords: ['roofing', 'North Alabama', 'Decatur', 'Huntsville', 'Madison', 'roof repair', 'roof replacement', 'storm damage'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Header />
        <main>{children}</main>
        <FloatingContactButton />
      </body>
    </html>
  );
}
