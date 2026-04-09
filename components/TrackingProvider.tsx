'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackingService } from '@/lib/tracking-service';

/**
 * TrackingProvider - Handles page view tracking and UTM capture.
 *
 * IMPORTANT: This must NOT wrap children. usePathname/useSearchParams cause Suspense
 * during streaming SSR, and wrapping the page tree causes everything inside to
 * fall back to null in the static HTML — breaking SEO (no H1, no schema, no content).
 *
 * Render this as a sibling to your page content, not a wrapper.
 */
export default function TrackingProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Initialize tracking on first load
    trackingService.initialize();
  }, []);

  useEffect(() => {
    // Track page view on route change
    if (pathname) {
      // Small delay to ensure page title is updated
      const timer = setTimeout(() => {
        trackingService.trackPageView(
          `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`,
          document.title
        );
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  return null;
}
