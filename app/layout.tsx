import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import Header from '@/components/Header';
import FloatingContactButton from '@/components/FloatingContactButton';
import GlobalVideoBackground from '@/components/GlobalVideoBackground';
import { generateMetadata, generateLocalBusinessSchema, getStructuredDataScript } from '@/lib/seo';

// Google Analytics ID - Replace with your actual GA4 Measurement ID
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-XXXXXXXXXX';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = generateMetadata({
  title: 'Professional Roofing Services in North Alabama',
  description: 'Licensed and insured roofing contractor serving Decatur, Huntsville, Madison, and all of North Alabama. Expert roof replacement, repair, and storm damage services.',
  keywords: [
    'Alabama roofing company',
    'licensed roofer',
    'insured contractor',
    'free inspection',
    'roof warranty',
  ],
  path: '/',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Generate structured data for local business
  const localBusinessSchema = generateLocalBusinessSchema();
  const structuredDataScript = getStructuredDataScript(localBusinessSchema);

  return (
    <html lang="en">
      <head>
        {/* Google Analytics */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        {/* Structured Data (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredDataScript }}
        />
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Theme color */}
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="dark light" />
      </head>
      <body className={inter.className}>
        <GlobalVideoBackground
          videoSrc="/uploads/hero-video.mp4"
          fallbackImage="/uploads/hero-background.jpg"
        />
        <Header />
        <main>{children}</main>
        <FloatingContactButton />
      </body>
    </html>
  );
}
