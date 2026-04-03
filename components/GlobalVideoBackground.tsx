'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface GlobalVideoBackgroundProps {
  videoSrc: string;
  fallbackImage?: string;
}

export default function GlobalVideoBackground({
  videoSrc,
  fallbackImage = '/uploads/hero-background.webp',
}: GlobalVideoBackgroundProps) {
  // Start with video ON — render it in initial HTML for fast LCP.
  // Disable after mount only on mobile or slow connections.
  const [disableVideo, setDisableVideo] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pathname = usePathname();

  // After hydration, check if we should disable video (mobile/slow)
  useEffect(() => {
    if (window.innerWidth < 768) {
      setDisableVideo(true);
      return;
    }

    const connection = (navigator as any).connection ||
                       (navigator as any).mozConnection ||
                       (navigator as any).webkitConnection;

    if (connection) {
      const slow = connection.saveData ||
                   connection.effectiveType === 'slow-2g' ||
                   connection.effectiveType === '2g';
      if (slow) setDisableVideo(true);
    }
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
    setDisableVideo(true);
  };

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden"
      style={{ zIndex: -1 }}
      aria-hidden="true"
    >
      {/* Video Background — rendered in initial HTML for fast LCP */}
      {!disableVideo && (
        <video
          ref={videoRef}
          key={`video-${animationKey}`}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="/uploads/hero-video-poster.webp"
          onError={handleVideoError}
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/uploads/hero-video.webm" type="video/webm" />
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}

      {/* Background Image - always present as base layer */}
      <div
        key={`image-${animationKey}`}
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat animate-ken-burns"
        style={{ backgroundImage: `url(${fallbackImage})` }}
      />

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
