'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface GlobalVideoBackgroundProps {
  videoSrc: string;
  fallbackImage?: string;
}

export default function GlobalVideoBackground({
  videoSrc,
  fallbackImage = '/uploads/hero-video-poster.webp',
}: GlobalVideoBackgroundProps) {
  // Start with video OFF on initial render to avoid loading video resources
  // that compete with the LCP image. Enable after hydration on capable devices.
  const [showVideo, setShowVideo] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pathname = usePathname();

  // After hydration, check if we should enable video (desktop + fast connection)
  useEffect(() => {
    if (window.innerWidth < 768) return;

    const connection = (navigator as any).connection ||
                       (navigator as any).mozConnection ||
                       (navigator as any).webkitConnection;

    if (connection) {
      const slow = connection.saveData ||
                   connection.effectiveType === 'slow-2g' ||
                   connection.effectiveType === '2g';
      if (slow) return;
    }

    // Delay video load to avoid competing with LCP resources.
    // 3s gives the hero poster image clean network priority.
    const timer = setTimeout(() => setShowVideo(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Refresh animation on route change
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [pathname]);

  const handleVideoError = () => {
    setShowVideo(false);
  };

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden"
      style={{ zIndex: -1 }}
      aria-hidden="true"
    >
      {/* Video Background — loaded after hydration on desktop only */}
      {showVideo && (
        {/* No `loop` (owner request 2026-07-02): the shingle animation plays
            ONCE per page change, then holds on its final frame. The
            route-change effect above resets currentTime and replays it on
            every navigation. Bonus: a paused video costs zero CPU/battery. */}
        <video
          ref={videoRef}
          key={`video-${animationKey}`}
          autoPlay
          muted
          playsInline
          preload="none"
          poster={fallbackImage}
          onError={handleVideoError}
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/uploads/hero-video.webm" type="video/webm" />
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}

      {/* Background Image - always present as base layer.
          Using <img> instead of CSS background so the browser discovers it early and it can be the LCP.
          - No `key`: re-rendering the LCP element on every route change restarts the LCP timer.
          - Animation lives on a wrapper, not the img: animating the LCP element delays its
            "final paint" measurement and makes Lighthouse score the LCP later than it actually is. */}
      <div className="absolute inset-0 w-full h-full overflow-hidden animate-ken-burns" key={`ken-${animationKey}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fallbackImage}
          alt=""
          aria-hidden="true"
          decoding="async"
          fetchPriority="high"
          loading="eager"
          width={1920}
          height={1080}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Dark Overlay for readability */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Animated gradient overlay */}
      <div
        key={`gradient-${animationKey}`}
        className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70 animate-fade-in"
      />
    </div>
  );
}
