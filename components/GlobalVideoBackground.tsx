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
  const [useVideo, setUseVideo] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pathname = usePathname();

  // Check connection speed on mount
  useEffect(() => {
    const connection = (navigator as any).connection ||
                       (navigator as any).mozConnection ||
                       (navigator as any).webkitConnection;

    if (connection) {
      const dominated = connection.saveData ||
                       connection.effectiveType === 'slow-2g' ||
                       connection.effectiveType === '2g';

      if (!dominated) {
        setUseVideo(true);
      }
    } else {
      setUseVideo(true);
    }
  }, []);

  // Refresh animation on route change
  useEffect(() => {
    setAnimationKey(prev => prev + 1);

    // Restart video from beginning on route change
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [pathname]);

  // Video load timeout fallback
  useEffect(() => {
    if (useVideo && videoRef.current) {
      const timeout = setTimeout(() => {
        if (!videoLoaded) {
          setUseVideo(false);
        }
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [useVideo, videoLoaded]);

  const handleVideoLoaded = () => {
    setVideoLoaded(true);
  };

  const handleVideoError = () => {
    setUseVideo(false);
  };

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden"
      style={{ zIndex: -1 }}
    >
      {/* Video Background */}
      {useVideo && (
        <video
          ref={videoRef}
          key={`video-${animationKey}`}
          autoPlay
          muted
          loop
          playsInline
          onLoadedData={handleVideoLoaded}
          onError={handleVideoError}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            videoLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}

      {/* Fallback Image */}
      <div
        key={`image-${animationKey}`}
        className={`absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ${
          useVideo && videoLoaded ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ backgroundImage: `url(${fallbackImage})` }}
      />

      {/* Dark Overlay for readability */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Animated gradient overlay that refreshes on page change */}
      <div
        key={`gradient-${animationKey}`}
        className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70 animate-fade-in"
      />
    </div>
  );
}
