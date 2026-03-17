import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import '../globals.css';
import { generateMetadata as genMeta, siteConfig } from '@/lib/seo';

const inter = Inter({ subsets: ['latin'] });

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-Y8PB85BZC5';
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || '';

export const metadata: Metadata = genMeta({
  title: 'River City Roofing Solutions',
  description: siteConfig.description,
});

/**
 * Landing Page Layout — NO header, footer, navigation, video background, or popups.
 * Designed for Google Ads traffic: convert or leave.
 * Includes GA + Google Ads tracking for conversion measurement.
 */
export default function LandingPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/icon-192x192.png" type="image/png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <meta name="theme-color" content="#1a1a2e" />
      </head>
      <body className={`${inter.className} bg-black text-white`} suppressHydrationWarning>
        {/* Google Analytics + Ads */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics-lp" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
              send_page_view: true
            });
            ${GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : ''}
          `}
        </Script>

        {/* Google Ads Conversion Tracking Tag */}
        {GOOGLE_ADS_ID && (
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
            strategy="afterInteractive"
          />
        )}

        {children}
      </body>
    </html>
  );
}
