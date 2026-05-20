'use client';

/**
 * BeforeAfterSlider — draggable image comparison slider.
 *
 *   <BeforeAfterSlider
 *     beforeSrc="/uploads/foo-before.jpg"
 *     afterSrc="/uploads/foo-after.jpg"
 *     beforeAlt="Storm-damaged roof before repair"
 *     afterAlt="Same roof after replacement"
 *     caption="Decatur, AL — hail damage to new IKO Dynasty"
 *     priority   // Eager-load images for the first instance on a page
 *   />
 *
 * Interaction:
 *  - Mouse drag, touch drag, click anywhere on the strip to jump there.
 *  - Keyboard: arrow keys (←/→) move 5%, shift+arrow moves 20%,
 *    Home/End jump to 0/100. Focus the handle to use them.
 *
 * Implementation notes:
 *  - Uses CSS clip-path to mask the after image; no JS-driven animation
 *    library, just React state + cheap inline styles.
 *  - Both images are rendered as Next <Image fill> inside an aspect-ratio
 *    container so there's NO layout shift when they load.
 *  - Works in light + dark themes — the chrome (handle, caption) uses
 *    semi-transparent surfaces so it sits on top of any background.
 *  - Brand accent #0066CC matches email templates.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';

export interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt?: string;
  afterAlt?: string;
  caption?: string;
  /** Initial split position, 0-100 (default 50). */
  initial?: number;
  /** Pass true for the first instance above the fold. */
  priority?: boolean;
  /** Tailwind aspect-ratio class — default 16:9. */
  aspectClassName?: string;
  className?: string;
}

const ACCENT = '#0066CC';

function clamp(n: number, lo = 0, hi = 100): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

export default function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeAlt = 'Before',
  afterAlt = 'After',
  caption,
  initial = 50,
  priority = false,
  aspectClassName = 'aspect-[16/9]',
  className = '',
}: BeforeAfterSliderProps) {
  const [pos, setPos] = useState<number>(clamp(initial));
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(clamp(pct));
  }, []);

  // Pointer-based drag (covers mouse + touch + pen).
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      updateFromClientX(e.clientX);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, updateFromClientX]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(true);
    updateFromClientX(e.clientX);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const big = e.shiftKey ? 20 : 5;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setPos((p) => clamp(p - big));
        break;
      case 'ArrowRight':
        e.preventDefault();
        setPos((p) => clamp(p + big));
        break;
      case 'Home':
        e.preventDefault();
        setPos(0);
        break;
      case 'End':
        e.preventDefault();
        setPos(100);
        break;
    }
  };

  return (
    <figure className={['w-full', className].join(' ')}>
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        className={[
          'relative w-full overflow-hidden rounded-xl select-none',
          'bg-neutral-200 dark:bg-neutral-900',
          'shadow-lg ring-1 ring-black/5 dark:ring-white/10',
          aspectClassName,
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        ].join(' ')}
      >
        {/* BEFORE — sits underneath, full width. */}
        <Image
          src={beforeSrc}
          alt={beforeAlt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1100px"
          priority={priority}
          className="object-cover pointer-events-none"
          draggable={false}
        />

        {/* AFTER — clipped to the left of the split. */}
        <div
          className="absolute inset-0 will-change-[clip-path]"
          style={{
            clipPath: `inset(0 ${100 - pos}% 0 0)`,
            WebkitClipPath: `inset(0 ${100 - pos}% 0 0)`,
            transition: dragging ? 'none' : 'clip-path 120ms ease-out',
          }}
        >
          <Image
            src={afterSrc}
            alt={afterAlt}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1100px"
            priority={priority}
            className="object-cover pointer-events-none"
            draggable={false}
          />
        </div>

        {/* Corner labels — only visible when their side has space. */}
        <span
          aria-hidden="true"
          className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-black/60 text-white backdrop-blur-sm"
          style={{ opacity: pos > 8 ? 1 : 0, transition: 'opacity 150ms' }}
        >
          After
        </span>
        <span
          aria-hidden="true"
          className="absolute top-3 right-3 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-black/60 text-white backdrop-blur-sm"
          style={{ opacity: pos < 92 ? 1 : 0, transition: 'opacity 150ms' }}
        >
          Before
        </span>

        {/* Divider line */}
        <div
          aria-hidden="true"
          className="absolute top-0 bottom-0 w-[2px] pointer-events-none"
          style={{
            left: `calc(${pos}% - 1px)`,
            background: ACCENT,
            transition: dragging ? 'none' : 'left 120ms ease-out',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.35)',
          }}
        />

        {/* Handle — also the keyboard-focusable control. */}
        <button
          type="button"
          aria-label="Before/after comparison slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          role="slider"
          onKeyDown={onKeyDown}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-11 w-11 rounded-full flex items-center justify-center text-white font-bold shadow-lg focus:outline-none focus:ring-4 focus:ring-[#0066CC]/40"
          style={{
            left: `${pos}%`,
            background: ACCENT,
            transition: dragging ? 'none' : 'left 120ms ease-out',
            touchAction: 'none',
          }}
        >
          {/* Double chevron icon — pure SVG so we don't pull in lucide here */}
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
            <polyline points="9 18 3 12 9 6" transform="translate(12 0)" />
          </svg>
        </button>
      </div>

      {caption && (
        <figcaption className="mt-3 text-sm text-neutral-600 dark:text-neutral-300 text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
