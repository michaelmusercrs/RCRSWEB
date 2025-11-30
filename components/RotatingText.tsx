'use client';

import { useState, useEffect } from 'react';

interface RotatingTextProps {
  phrases: string[];
  interval?: number;
  className?: string;
}

export default function RotatingText({
  phrases,
  interval = 4000,
  className = ''
}: RotatingTextProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Initial slide in
  useEffect(() => {
    const initialDelay = setTimeout(() => {
      setIsVisible(true);
    }, 300);
    return () => clearTimeout(initialDelay);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      // Slide out
      setIsVisible(false);

      // After slide out, change text and slide in
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % phrases.length);
        setIsVisible(true);
      }, 800);
    }, interval);

    return () => clearInterval(timer);
  }, [phrases.length, interval]);

  return (
    <div className={`overflow-hidden ${className}`}>
      <p
        className={`transition-all duration-700 ease-out transform ${
          isVisible
            ? 'opacity-100 translate-x-0'
            : 'opacity-0 -translate-x-full'
        }`}
      >
        {phrases[currentIndex]}
      </p>
    </div>
  );
}
