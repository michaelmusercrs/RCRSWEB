import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Suspense } from 'react';
// SpeedInsights loaded dynamically to avoid blocking LCP

import '../globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FloatingContactButton from '@/components/FloatingContactButton';
// ChatBot disabled — not yet configured (2026-02-17)
// import ChatBot from '@/components/ChatBot';
import GlobalVideoBackground from '@/components/GlobalVideoBackground';
import PromoBanner from '@/components/PromoBanner';
import SandboxBanner from '@/components/SandboxBanner';
import dynamic from 'next/dynamic';
const CookieConsent = dynamic(() => import('@/components/CookieConsent'), { ssr: false });
const EmailCapturePopup = dynamic(() => import('@/components/EmailCapturePopup'), { ssr: false });
import TrackingProvider from '@/components/TrackingProvider';
const AnalyticsTracker = dynamic(() => import('@/components/AnalyticsTracker'), { ssr: false });
const SpeedInsights = dynamic(
  () => import('@vercel/speed-insights/next').then(mod => ({ default: mod.SpeedInsights })),
  { ssr: false }
);
import { generateMetadata, generateLocalBusinessSchema, generateWebSiteSchema, generateFAQSchema, getStructuredDataScript, siteConfig } from '@/lib/seo';

// Tracking IDs from environment variables
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-Y8PB85BZC5';
// TODO: Michael — set NEXT_PUBLIC_FB_PIXEL_ID in .env with your Facebook Pixel ID
// Get it from: Facebook Events Manager → Data Sources → Your Pixel → Settings
const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '';

// TODO: Michael — set NEXT_PUBLIC_GOOGLE_ADS_ID in .env with your Google Ads Conversion ID
// Get it from: Google Ads → Tools → Conversions → Tag setup (format: AW-XXXXXXXXX)
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || '';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = generateMetadata({
  title: 'Roofing Contractor Decatur & Huntsville AL | Roof Replacement & Storm Damage Repair',
  description: '#1 rated roofing contractor in Decatur & Huntsville AL. Free roof inspections, roof replacement, storm damage repair & insurance claims. Serving Madison, Athens & all of North Alabama. BBB A+ rated. Call (256) 274-8530.',
  keywords: [
    'roofing contractor Decatur AL',
    'roofing contractor Huntsville AL',
    'roof replacement Decatur AL',
    'roof replacement Huntsville AL',
    'storm damage roof repair North Alabama',
    'hail damage roof repair Decatur AL',
    'best roofer Decatur AL',
    'best roofer Huntsville AL',
    'free roof inspection Decatur AL',
    'free roof inspection Huntsville AL',
    'roofing company near me',
    'emergency roof repair North Alabama',
    'insurance claim roofing contractor',
    'commercial roofing Huntsville AL',
    'metal roofing Decatur AL',
    'gutter installation North Alabama',
    'North Alabama roofing company',
    'Madison AL roofing',
    'Athens AL roofer',
    'residential roof replacement Alabama',
  ],
  path: '/',
});

// Site-wide FAQ schema (also relevant on the homepage for rich results)
const SITE_WIDE_FAQS = [
  {
    question: 'How much does a new roof cost in North Alabama?',
    answer: 'The cost of a new roof depends on the size of your roof, materials chosen, and complexity of the job. We offer free inspections and detailed quotes so you know exactly what to expect — no obligation.',
  },
  {
    question: 'Do you offer free roof inspections?',
    answer: 'Yes! We provide completely free, no-obligation roof inspections for homeowners across North Alabama. Our certified inspectors will assess your roof\'s condition, document any issues with photos, and provide honest recommendations.',
  },
  {
    question: 'How long does a roof replacement take?',
    answer: 'Most residential roof replacements are completed in 1-3 days, depending on the size and complexity of the project. We work efficiently to minimize disruption to your daily life while ensuring top-quality workmanship.',
  },
  {
    question: 'Do you help with insurance claims for storm damage?',
    answer: 'Absolutely! We have extensive experience working with insurance companies on storm and hail damage claims. We handle all documentation, photos, and communication with your insurance adjuster to maximize your claim.',
  },
  {
    question: 'What areas do you serve?',
    answer: 'We serve all of North Alabama including Decatur, Huntsville, Madison, Athens, Owens Cross Roads, and surrounding communities. We\'re expanding to Birmingham and Nashville. Contact us to confirm service in your area.',
  },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Generate structured data for local business and website
  const localBusinessSchema = generateLocalBusinessSchema();
  const webSiteSchema = generateWebSiteSchema();
  const faqSchema = generateFAQSchema(SITE_WIDE_FAQS);
  // Combine schemas into an array for multiple structured data blocks
  const combinedSchemas = [localBusinessSchema, webSiteSchema, faqSchema];

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Preconnect to third-party origins so the TCP+TLS handshake completes
            before the actual request. Saves ~100-300ms on analytics-heavy first paint. */}
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.google-analytics.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
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
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
        {/* Theme color */}
        <meta name="theme-color" content="#1a1a2e" />
        <meta name="color-scheme" content="dark light" />
        {/* PWA Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RCRS" />
        <meta name="application-name" content="River City Roofing Solutions" />
        <meta name="msapplication-TileColor" content="#1a1a2e" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="format-detection" content="telephone=no" />
        {/* Preload the hero background — this IS the LCP element on mobile.
            It's a full-viewport <img> rendered by GlobalVideoBackground that
            becomes the largest painted pixel area before the logo loads. */}
        <link
          rel="preload"
          href="/uploads/hero-video-poster.webp"
          as="image"
          type="image/webp"
          fetchPriority="high"
        />
        {/* Note: we previously preloaded the logo too, but it competed with
            the hero poster for bandwidth and was redundant — the <Image
            priority fetchPriority="high"> on the homepage already handles it,
            and on every other page the logo isn't above the fold. */}
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {/* Google Tag Manager / Analytics with Consent Mode */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="lazyOnload"
        />
        <Script id="google-analytics" strategy="lazyOnload">
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
          <Script id="facebook-pixel-noscript" strategy="lazyOnload">
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
            strategy="lazyOnload"
          />
        )}

        <SandboxBanner />
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-brand-green focus:text-black focus:px-4 focus:py-2 focus:rounded focus:font-bold focus:text-lg">
          Skip to main content
        </a>
        {/* Page content renders directly to HTML — NO Suspense wrapper, so H1/schema/content
            all appear in the static HTML for SEO crawlers. */}
        <div className="sticky top-0 z-50">
          <PromoBanner />
          <Header />
        </div>
        <GlobalVideoBackground
          videoSrc="/uploads/hero-video.mp4"
          fallbackImage="/uploads/hero-video-poster.webp"
        />
        <main id="main-content">{children}</main>
        <Footer />
        <FloatingContactButton />
        {/* <ChatBot /> — disabled until configured */}
        <EmailCapturePopup />
        {/* Honeypot links — invisible to humans, irresistible to bots */}
        <a href="/api/honeypot" style={{position:'absolute',left:'-9999px',opacity:0,height:0,width:0,overflow:'hidden'}} tabIndex={-1} aria-hidden="true">Special Roofing Deals</a>
        <a href="/api/honeypot?src=admin" style={{position:'absolute',left:'-9999px',opacity:0,height:0,width:0,overflow:'hidden'}} tabIndex={-1} aria-hidden="true">Admin Panel</a>
        {/* Tracking components — sibling to content, wrapped in their own Suspense.
            They use useSearchParams which would otherwise suspend the entire page tree. */}
        <Suspense fallback={null}>
          <TrackingProvider />
          <AnalyticsTracker />
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