import fs from 'fs';

// 1. Revert careers dollar amounts
let careers = fs.readFileSync('app/(site)/careers/page.tsx','utf8');
careers = careers.replace("{ value: 'Uncapped', label: 'Earning Potential' }", "{ value: '$100K+', label: 'Potential Earnings' }");
careers = careers.replace("{ value: 'Thousands', label: 'Donated to Community' }", "{ value: '$100K+', label: 'Donated to Community' }");
careers = careers.replace(/donated thousands/g, 'donated over $100,000');
careers = careers.replace(/six figures annually/g, 'well over $100K annually');
fs.writeFileSync('app/(site)/careers/page.tsx', careers);
console.log('careers reverted');

// 2. Make homepage banner rotate instead of showing all at once
let home = fs.readFileSync('app/(site)/page.tsx','utf8');

// Replace the static banner with a rotating one
const oldBanner = `{/* Announcement Banner */}
      <div className="bg-brand-green text-black py-2.5 px-4 text-center text-sm font-bold relative z-50">
        <div className="container mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
          <Link href="/community" className="hover:underline inline-flex items-center gap-1">
            🏫 Raise the Roof for Schools — $250 donated per roof replacement
          </Link>
          <span className="hidden sm:inline text-black/40">|</span>
          <Link href="/check-my-address" className="hover:underline inline-flex items-center gap-1">
            ⛈️ Free Storm Report — Check your address now
          </Link>
          <span className="hidden sm:inline text-black/40">|</span>
          <Link href="/services" className="hover:underline inline-flex items-center gap-1">
            🏠 IKO ROOFViewer — See new shingles on your home
          </Link>
        </div>
      </div>`;

const newBanner = `{/* Rotating Announcement Banner */}
      <RotatingBanner />`;

if (home.includes(oldBanner)) {
  home = home.replace(oldBanner, newBanner);
  console.log('banner replaced in homepage');
} else {
  console.log('WARNING: could not find banner text to replace');
  // Try to find it
  const idx = home.indexOf('Announcement Banner');
  console.log('Found "Announcement Banner" at index:', idx);
}

fs.writeFileSync('app/(site)/page.tsx', home);

// 3. Create RotatingBanner component
const rotatingBanner = `'use client';

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
    emoji: '📞',
    text: 'Free Roof Inspection — Call (256) 274-8530',
    href: 'tel:256-274-8530',
  },
];

export default function RotatingBanner() {
  const [current, setCurrent] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % bannerItems.length);
        setFade(true);
      }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const item = bannerItems[current];

  return (
    <div className="bg-brand-green text-black py-2.5 px-4 text-center text-sm font-bold relative z-50">
      <div className="container mx-auto">
        <Link
          href={item.href}
          className={\`hover:underline inline-flex items-center gap-2 transition-opacity duration-300 \${fade ? 'opacity-100' : 'opacity-0'}\`}
        >
          <span>{item.emoji}</span>
          <span>{item.text}</span>
        </Link>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('components/RotatingBanner.tsx', rotatingBanner);
console.log('RotatingBanner component created');
