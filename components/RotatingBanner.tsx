'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const bannerItems = [
  {
    emoji: '🏫',
    text: 'Raise the Roof for Schools — $250 donated per roof replacement',
    href: '/community',
  },
  {
    emoji: '⛈️',
    text: 'Free Storm Report — Check your address now',
    href: '/check-my-address',
  },
  {
    emoji: '🏠',
    text: 'IKO ROOFViewer — See new shingles on your home',
    href: '/services',
  },
  {
    emoji: '🏆',
    text: 'IKO ROOFPRO • Owens Corning Preferred • Boral Certified — Triple Certified Contractor',
    href: '/about',
  },
  {
    emoji: '📞',
    text: 'Free Roof Inspection — Call (256) 274-8530',
    href: 'tel:256-274-8530',
  },
];

export default function RotatingBanner() {
  const [current, setCurrent] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % bannerItems.length);
        requestAnimationFrame(() => setFade(true));
      }, 300);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const item = bannerItems[current];

  return (
    <div className="bg-brand-green text-black py-2.5 px-4 text-center text-sm font-bold relative z-50 min-h-[40px] flex items-center">
      <div className="container mx-auto">
        <Link
          href={item.href}
          className={`hover:underline inline-flex items-center gap-2 transition-opacity duration-300 ${fade ? 'opacity-100' : 'opacity-0'}`}
        >
          <span>{item.emoji}</span>
          <span>{item.text}</span>
        </Link>
      </div>
    </div>
  );
}
