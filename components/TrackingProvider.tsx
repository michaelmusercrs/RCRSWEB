'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackingService } from '@/lib/tracking-service';

/**
 * TrackingProvider - Handles page view tracking and UTM capture
 * Place this component inside your layout to track all page views
 */
export default function TrackingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return <>{children}</>;
}
