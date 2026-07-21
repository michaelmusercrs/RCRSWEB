'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import styles from './HeroIntroSplash.module.css';

// Bump this key to make the intro play again for everyone (e.g. after a redesign).
const SEEN_KEY = 'rcrs-intro-v1';

// Depth of the extruded solid — number of stacked, depth-shaded logo slices.
const DEPTH = 30;
const STEP = 1.2;

type Phase = 'hidden' | 'playing' | 'done';

/**
 * One-time homepage intro splash. Plays the 3D logo drop once per browser
 * session, then fades out and fully unmounts (no lingering DOM or animation).
 * Repeat visits, other pages, reduced-motion, and slow devices are all handled:
 * the overlay only ever appears on a first, motion-friendly homepage visit and
 * otherwise renders nothing.
 */
export default function HeroIntroSplash() {
  const [phase, setPhase] = useState<Phase>('hidden');

  // Pre-compute the extruded slices once.
  const slices = useMemo(() => {
    const n = Math.max(2, Math.round(DEPTH / STEP));
    return Array.from({ length: n + 1 }, (_, i) => {
      const z = -DEPTH / 2 + i * STEP;
      const t = i / n; // 0 = back, 1 = front face
      return {
        z: Number(z.toFixed(2)),
        brightness: Number((0.34 + 0.66 * t).toFixed(3)),
        front: i === n,
      };
    });
  }, []);

  const dismiss = useCallback(() => {
    setPhase((p) => {
      if (p !== 'playing') return p;
      try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode */ }
      document.body.style.overflow = '';
      // let the fade finish, then unmount
      window.setTimeout(() => setPhase('hidden'), 650);
      return 'done';
    });
  }, []);

  useEffect(() => {
    let seen = false;
    try { seen = !!sessionStorage.getItem(SEEN_KEY); } catch { /* ignore */ }
    if (seen) return; // repeat visit — never show

    setPhase('playing');
    document.body.style.overflow = 'hidden';

    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Hold long enough for the drop to settle, then fade. Reduced-motion shows
    // the settled logo only briefly.
    const holdMs = reduce ? 900 : 3050;
    const timer = window.setTimeout(dismiss, holdMs);

    const onKey = (e: KeyboardEvent) => { if (e.key) dismiss(); };
    window.addEventListener('keydown', onKey);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [dismiss]);

  if (phase === 'hidden') return null;

  return (
    <div
      className={`${styles.overlay} ${phase === 'playing' ? styles.play : styles.done}`}
      role="dialog"
      aria-label="River City Roofing Solutions"
      onClick={dismiss}
    >
      <div
        className={styles.bg}
        style={{ backgroundImage: "url('/uploads/hero-video-poster.webp')" }}
      />
      <div className={styles.overlay2} />
      <div className={styles.vignette} />

      <div className={styles.scene}>
        <div className={styles.contact} />
        <div className={styles.rig}>
          <div className={styles.lift}>
            <div className={styles.solid}>
              {slices.map((s, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  className={`${styles.slice} ${s.front ? styles.faceFront : ''}`}
                  src="/logo-nobg.png"
                  alt={s.front ? 'River City Roofing Solutions' : ''}
                  aria-hidden={s.front ? undefined : true}
                  draggable={false}
                  style={{ transform: `translateZ(${s.z}px)`, filter: `brightness(${s.brightness})` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.caption}>Roofing · Solutions · North Alabama</div>
      <button className={styles.skip} type="button" onClick={dismiss}>Skip ↵</button>
    </div>
  );
}
