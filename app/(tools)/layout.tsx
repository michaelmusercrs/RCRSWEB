import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import '../globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RCRS Internal Tools',
  description: 'River City Roofing Solutions — Internal Tools',
};

// Clean layout for internal tools — NO site header, footer, video, popups, analytics
export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/icon-192x192.png" type="image/png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="manifest" href="/manifest-portal.json" />
        <meta name="theme-color" content="#0a0a0f" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RCRS Portal" />
        <meta name="application-name" content="RCRS Portal" />
      </head>
      <body className={`${inter.className} bg-[#0a0a0f] text-white`}>
        {children}

        {/* Service Worker Registration for PWA */}
        <Script id="sw-register-tools" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js', { scope: '/' })
                  .then(function(registration) {
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
