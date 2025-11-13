'use client';

import { useState, useEffect } from 'react';

const phrases = [
  'Trusted Roofing Experts',
  'Quality You Can Count On',
  'Protecting Your Investment',
  'Local Family Business',
  'Licensed & Insured',
];

export default function AnimatedHeroText() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % phrases.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-16 md:h-20 relative overflow-hidden">
      {phrases.map((phrase, index) => (
        <div
          key={index}
          className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ${
            index === currentIndex
              ? 'opacity-100 translate-y-0'
              : index < currentIndex
              ? 'opacity-0 -translate-y-full'
              : 'opacity-0 translate-y-full'
          }`}
        >
          <span className="text-brand-green text-2xl md:text-4xl font-bold">
            {phrase}
          </span>
        </div>
      ))}
    </div>
  );
}
