'use client';

import { useState, useEffect, useRef } from 'react';

interface VideoBackgroundProps {
  videoSrc: string;
  fallbackImage?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function VideoBackground({
  videoSrc,
  fallbackImage = '/uploads/hero-background.jpg',
  className = '',
  children
}: VideoBackgroundProps) {
  const [useVideo, setUseVideo] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Check connection speed - only load video on fast connections
    const connection = (navigator as any).connection ||
                       (navigator as any).mozConnection ||
                       (navigator as any).webkitConnection;

    if (connection) {
      // Don't load video on slow connections (2g, slow-2g) or if saveData is enabled
      const dominated = connection.saveData ||
                       connection.effectiveType === 'slow-2g' ||
                       connection.effectiveType === '2g';

      if (!dominated) {
        setUseVideo(true);
      }
    } else {
      // If Network Information API not available, try to load video
      setUseVideo(true);
    }
  }, []);

  useEffect(() => {
    if (useVideo && videoRef.current) {
      // Set a timeout - if video doesn't load in 3 seconds, fall back to image
      const timeout = setTimeout(() => {
        if (!videoLoaded) {
          setUseVideo(false);
        }
      }, 3000);

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
    <div className={`relative ${className}`}>
      {/* Content Container */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
