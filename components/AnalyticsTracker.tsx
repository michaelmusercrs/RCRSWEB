'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackingService } from '@/lib/tracking-service';

/**
 * Enhanced Analytics Tracker
 * Tracks scroll depth, time on page, exit intent, and CTA clicks.
 * Added to site layout — runs on every page.
 */
export default function AnalyticsTracker() {
  const pathname = usePathname();
  const scrollMilestonesRef = useRef<Set<number>>(new Set());
  const timeMilestonesRef = useRef<Set<number>>(new Set());
  const pageLoadTimeRef = useRef<number>(Date.now());
  const exitIntentFiredRef = useRef(false);

  // Reset on route change
  useEffect(() => {
    scrollMilestonesRef.current = new Set();
    timeMilestonesRef.current = new Set();
    pageLoadTimeRef.current = Date.now();
    exitIntentFiredRef.current = false;
  }, [pathname]);

  // Scroll depth tracking
  useEffect(() => {
    const milestones = [25, 50, 75, 100];

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const percent = Math.round((scrollTop / docHeight) * 100);

      for (const m of milestones) {
        if (percent >= m && !scrollMilestonesRef.current.has(m)) {
          scrollMilestonesRef.current.add(m);
          trackingService.trackEvent('page_view', {
            event_category: 'engagement',
            event_label: `scroll_depth_${m}`,
            value: m,
          });
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [pathname]);

  // Time on page tracking
  useEffect(() => {
    const milestones = [15, 30, 60, 120, 300]; // seconds

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - pageLoadTimeRef.current) / 1000);
      for (const m of milestones) {
        if (elapsed >= m && !timeMilestonesRef.current.has(m)) {
          timeMilestonesRef.current.add(m);
          trackingService.trackEvent('page_view', {
            event_category: 'engagement',
            event_label: `time_on_page_${m}s`,
            value: m,
          });
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pathname]);

  // Exit intent (desktop only — mouse leaves viewport)
  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !exitIntentFiredRef.current) {
        exitIntentFiredRef.current = true;
        trackingService.trackEvent('page_view', {
          event_category: 'engagement',
          event_label: 'exit_intent',
        });
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [pathname]);

  // CTA click tracking (delegation)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a, button');
      if (!target) return;

      const text = target.textContent?.trim() || '';
      const href = target.getAttribute('href') || '';

      // Track phone clicks
      if (href.startsWith('tel:')) {
        trackingService.trackPhoneClick(href.replace('tel:', ''), pathname || undefined);
        return;
      }

      // Track CTA-like buttons/links
      const ctaKeywords = ['free', 'inspection', 'quote', 'schedule', 'call', 'contact', 'get started', 'submit'];
      const isCtaLike = ctaKeywords.some(k => text.toLowerCase().includes(k));
      if (isCtaLike) {
        trackingService.trackCTAClick(text, pathname || undefined);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [pathname]);

  // Form start tracking (delegation)
  useEffect(() => {
    let formStarted = false;

    const handleFocus = (e: FocusEvent) => {
      if (formStarted) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        const form = target.closest('form');
        if (form) {
          formStarted = true;
          trackingService.trackFormStart(form.id || 'unknown_form');
        }
      }
    };

    document.addEventListener('focusin', handleFocus);
    return () => {
      document.removeEventListener('focusin', handleFocus);
    };
  }, [pathname]);

  return null;
}
