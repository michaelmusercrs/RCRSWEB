'use client';

import { useEffect, useRef } from 'react';

/**
 * Customer-portal analytics beacon.
 *
 *  - Fires `portal_view` on mount
 *  - Fires `tile_interact` when the user clicks anything with [data-track="..."]
 *    inside a [data-tile="..."] container (delegates from the body)
 *  - Fires `time_on_page` via sendBeacon on beforeunload + visibilitychange=hidden
 *
 * Honors ?preview=1 — flagged as isPreview=true so admin previews don't
 * pollute real engagement counts.
 *
 * Drops silently on any error — never block the customer portal UX.
 */
export default function AnalyticsBeacon({
  portalToken,
  isPreview = false,
}: {
  portalToken: string;
  isPreview?: boolean;
}) {
  const mountedAt = useRef<number>(Date.now());
  const sent = useRef<{ unload: boolean }>({ unload: false });

  useEffect(() => {
    // ── portal_view ────────────────────────────────────────────────────
    fetch('/api/portal/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portalToken,
        eventType: 'portal_view',
        isPreview,
      }),
      keepalive: true,
    }).catch(() => { /* drop silently */ });

    // ── tile_interact (click delegation) ────────────────────────────────
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.('[data-track]') as HTMLElement | null;
      if (!el) return;
      const evType = el.getAttribute('data-track') || 'tile_interact';
      const tileEl = el.closest('[data-tile]') as HTMLElement | null;
      const tileKey = tileEl?.getAttribute('data-tile') || '';
      fetch('/api/portal/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portalToken,
          eventType: evType.startsWith('tile_') || evType === 'tile_interact' ? 'tile_interact' : evType,
          tileKey,
          isPreview,
        }),
        keepalive: true,
      }).catch(() => { /* drop silently */ });
    };

    // ── time_on_page (via sendBeacon on unload) ────────────────────────
    const sendUnload = () => {
      if (sent.current.unload) return;
      sent.current.unload = true;
      const timeOnPageMs = Date.now() - mountedAt.current;
      try {
        const payload = JSON.stringify({
          portalToken,
          eventType: 'portal_view',
          timeOnPageMs,
          isPreview,
        });
        // sendBeacon survives page transitions; fall back to keepalive fetch
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/portal/event', new Blob([payload], { type: 'application/json' }));
        } else {
          fetch('/api/portal/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => { /* drop silently */ });
        }
      } catch { /* drop silently */ }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') sendUnload();
    };

    document.addEventListener('click', onClick, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', sendUnload);
    window.addEventListener('pagehide', sendUnload);

    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', sendUnload);
      window.removeEventListener('pagehide', sendUnload);
      sendUnload(); // strict-mode double-unmount safety
    };
  }, [portalToken, isPreview]);

  return null;
}
