'use client';

/**
 * MobileCTABar — fixed bottom strip with Call + Text Us actions.
 *
 * Behavior:
 *  - Mobile only (hidden at >= md).
 *  - Hidden until the user scrolls past 600px (past the hero) — keeps the
 *    fold clean for first impression.
 *  - On scroll-up the bar slides out of view so more content is visible;
 *    on scroll-down it slides back in.
 *  - Opts out automatically on the pages listed in OPT_OUT_PATHS (storm
 *    report form + contact pages already have a primary CTA above the fold).
 *  - Respects iOS Safari home-bar via env(safe-area-inset-bottom).
 *
 * Brand: uses #0066CC (brand-blue) accent for the primary Call button.
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Phone, MessageSquare } from 'lucide-react';
import { trackingService } from '@/lib/tracking-service';

const PHONE = '256-274-8530';
const PHONE_DISPLAY = '(256) 274-8530';

// Pages where a primary CTA already lives above the fold — don't double up.
const OPT_OUT_PATHS: ReadonlyArray<string | RegExp> = [
  '/contact',
  /^\/contact(\/.*)?$/,
  '/check-my-address',
  /^\/check-my-address(\/.*)?$/,
];

const SHOW_AFTER_PX = 600;

function isOptedOut(pathname: string | null): boolean {
  if (!pathname) return false;
  return OPT_OUT_PATHS.some((p) =>
    typeof p === 'string' ? pathname === p : p.test(pathname)
  );
}

export default function MobileCTABar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [hiddenByScrollUp, setHiddenByScrollUp] = useState(false);

  useEffect(() => {
    // Reset on route change so the bar re-evaluates against the new page.
    setVisible(false);
    setHiddenByScrollUp(false);

    if (isOptedOut(pathname)) return;

    let lastY = typeof window !== 'undefined' ? window.scrollY : 0;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const goingUp = y < lastY;
        const pastHero = y > SHOW_AFTER_PX;

        setVisible(pastHero);
        // Hide on scroll-up only when we'd otherwise be showing.
        setHiddenByScrollUp(goingUp && pastHero && y > lastY - 4 ? goingUp : goingUp);

        lastY = y;
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Run once so a page that's already scrolled (back/forward nav) is correct.
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  if (isOptedOut(pathname)) return null;

  const shown = visible && !hiddenByScrollUp;

  const handleCall = () => {
    try {
      trackingService.trackPhoneClick(PHONE, 'Mobile CTA Bar');
    } catch {
      /* tracking is best-effort */
    }
  };

  const handleText = () => {
    try {
      trackingService.trackCTAClick('Text Us', 'Mobile CTA Bar');
    } catch {
      /* tracking is best-effort */
    }
  };

  return (
    <div
      aria-hidden={!shown}
      className={[
        'md:hidden',
        'fixed inset-x-0 bottom-0 z-40',
        'transition-transform duration-300 ease-out',
        shown ? 'translate-y-0' : 'translate-y-full',
        'pointer-events-auto',
      ].join(' ')}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex gap-0 bg-black/95 backdrop-blur-sm border-t border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
        <a
          href={`tel:${PHONE}`}
          onClick={handleCall}
          className="flex-1 flex items-center justify-center gap-2 py-4 px-3 font-bold text-white text-base bg-[#0066CC] hover:bg-[#0052a3] active:bg-[#004282] transition-colors focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-inset"
          aria-label={`Call River City Roofing at ${PHONE_DISPLAY}`}
        >
          <Phone className="h-5 w-5" aria-hidden="true" />
          <span>Call {PHONE_DISPLAY}</span>
        </a>
        <a
          href={`sms:${PHONE}`}
          onClick={handleText}
          className="flex-1 flex items-center justify-center gap-2 py-4 px-3 font-bold text-black text-base bg-brand-green hover:bg-lime-400 active:bg-lime-500 transition-colors focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-inset"
          aria-label="Send a text message to River City Roofing"
        >
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
          <span>Text Us</span>
        </a>
      </div>
    </div>
  );
}
