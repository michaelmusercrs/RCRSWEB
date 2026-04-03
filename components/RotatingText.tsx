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
  // Start visible immediately — no delay that blocks LCP
  const [state, setState] = useState({ index: 0, visible: true });

  useEffect(() => {
    const timer = setInterval(() => {
      // Slide out
      setState(s => ({ ...s, visible: false }));

      // After slide out, change text and slide in
      setTimeout(() => {
        setState(s => ({ index: (s.index + 1) % phrases.length, visible: true }));
      }, 800);
    }, interval);

    return () => clearInterval(timer);
  }, [phrases.length, interval]);

  return (
    <div className={`overflow-hidden ${className}`}>
      <p
        className={`transition-all duration-700 ease-out transform ${
          state.visible
            ? 'opacity-100 translate-x-0'
            : 'opacity-0 -translate-x-full'
        }`}
      >
        {phrases[state.index]}
      </p>
    </div>
  );
}
