import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Suspense } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FloatingContactButton from '@/components/FloatingContactButton';
import ChatBot from '@/components/ChatBot';
import GlobalVideoBackground from '@/components/GlobalVideoBackground';
import PromoBanner from '@/components/PromoBanner';
import CookieConsent from '@/components/CookieConsent';
import EmailCapturePopup from '@/components/EmailCapturePopup';
import TrackingProvider from '@/components/TrackingProvider';
import { generateMetadata, generateLocalBusinessSchema, generateWebSiteSchema, getStructuredDataScript, siteConfig } from '@/lib/seo';

// Tracking IDs from environment variables
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-Y8PB85BZC5';
// TODO: Michael — set NEXT_PUBLIC_FB_PIXEL_ID in .env with your Facebook Pixel ID
// Get it from: Facebook Events Manager → Data Sources → Your Pixel → Settings
const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '';

// TODO: Michael — set NEXT_PUBLIC_GOOGLE_ADS_ID in .env with your Google Ads Conversion ID
// Get it from: Google Ads → Tools → Conversions → Tag setup (format: AW-XXXXXXXXX)
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || '';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = generateMetadata({
  title: 'Roofing Contractor Decatur, Huntsville & North Alabama',
  description: '#1 rated roofing company in North Alabama. Free roof inspections, storm damage repair & insurance claims. Serving Decatur, Huntsville, Madison, Athens & more. Call (256) 274-8530.',
  keywords: [
    'roofing contractor Decatur AL',
    'Huntsville roofer',
    'Madison AL roofing',
    'North Alabama roofing company',
    'roof replacement near me',
    'storm damage roof repair',
    'free roof inspection',
    'hail damage roofer',
  ],
  path: '/',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Generate structured data for local business and website
  const localBusinessSchema = generateLocalBusinessSchema();
  const webSiteSchema = generateWebSiteSchema();
  // Combine schemas into an array for multiple structured data blocks
  const combinedSchemas = [localBusinessSchema, webSiteSchema];

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Structured Data (JSON-LD) - LocalBusiness and WebSite schemas */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: getStructuredDataScript(combinedSchemas) }}
        />
        {/* Additional SEO Meta Tags */}
        <meta name="geo.region" content="US-AL" />
        <meta name="geo.placename" content="Decatur" />
        <meta name="geo.position" content={`${siteConfig.geo.latitude};${siteConfig.geo.longitude}`} />
        <meta name="ICBM" content={`${siteConfig.geo.latitude}, ${siteConfig.geo.longitude}`} />
        {/* Favicon */}
        <link rel="icon" href="/logo-nobg.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
        {/* Theme color */}
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="dark light" />
        {/* PWA Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RCRS" />
        <meta name="application-name" content="River City Roofing Solutions" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {/* Google Tag Manager / Analytics with Consent Mode */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}

            // Default consent mode - deny until user consents
            gtag('consent', 'default', {
              'analytics_storage': 'denied',
              'ad_storage': 'denied',
              'ad_user_data': 'denied',
              'ad_personalization': 'denied',
              'wait_for_update': 500
            });

            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
              send_page_view: true
            });
            ${GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : ''}
          `}
        </Script>

        {/* Facebook Pixel - Loads conditionally based on consent in tracking-service.ts */}
        {FB_PIXEL_ID && (
          <Script id="facebook-pixel-noscript" strategy="afterInteractive">
            {`
              // Facebook Pixel will be initialized by tracking-service.ts after consent
              window.FB_PIXEL_ID = '${FB_PIXEL_ID}';
            `}
          </Script>
        )}

        {/* Google Ads Remarketing Tag */}
        {GOOGLE_ADS_ID && (
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
            strategy="afterInteractive"
          />
        )}

        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-brand-green focus:text-black focus:px-4 focus:py-2 focus:rounded focus:font-bold focus:text-lg">
          Skip to main content
        </a>
        <Suspense fallback={null}>
          <TrackingProvider>
            <div className="sticky top-0 z-50">
              <PromoBanner />
              <Header />
            </div>
            <GlobalVideoBackground
              videoSrc="/uploads/hero-video.mp4"
              fallbackImage="/uploads/hero-background.webp"
            />
            <main id="main-content">{children}</main>
            <Footer />
            <FloatingContactButton />
            <ChatBot />
            <EmailCapturePopup />
            {/* Honeypot links — invisible to humans, irresistible to bots */}
            <a href="/api/honeypot" style={{position:'absolute',left:'-9999px',opacity:0,height:0,width:0,overflow:'hidden'}} tabIndex={-1} aria-hidden="true">Special Roofing Deals</a>
            <a href="/api/honeypot?src=admin" style={{position:'absolute',left:'-9999px',opacity:0,height:0,width:0,overflow:'hidden'}} tabIndex={-1} aria-hidden="true">Admin Panel</a>
          </TrackingProvider>
        </Suspense>

        <CookieConsent />
        <SpeedInsights />

        {/* Service Worker Registration */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                // Determine which manifest to use based on the current path
                var isPortal = window.location.pathname.startsWith('/portal');
                if (isPortal) {
                  var manifestLink = document.querySelector('link[rel="manifest"]');
                  if (manifestLink) {
                    manifestLink.setAttribute('href', '/manifest-portal.json');
                  }
                }

                navigator.serviceWorker.register('/sw.js', { scope: '/' })
                  .then(function(registration) {

                    // Check for updates periodically (every 60 minutes)
                    setInterval(function() {
                      registration.update();
                    }, 60 * 60 * 1000);
                  })
                  .catch(function(error) {
                    console.error('[PWA] Service Worker registration failed:', error);
                  });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}