'use client';

import Link from 'next/link';
import { X, Gift, Trophy } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function PromoBanner() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Check if banner was dismissed in this session
    const dismissed = sessionStorage.getItem('promoBannerDismissed');
    if (dismissed) {
      setIsVisible(false);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('promoBannerDismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-brand-green via-emerald-600 to-brand-green text-white text-outline-black relative">
      <div className="container mx-auto px-4 py-2">
        <Link href="/contact" className="flex items-center justify-center gap-2 text-sm md:text-base font-bold hover:opacity-90 transition-opacity">
          <Trophy className="w-5 h-5 animate-pulse" />
          <span className="hidden sm:inline">FREE ROOF INSPECTIONS</span>
          <span>Storm damage? We handle your insurance claim <span className="bg-white/20 px-2 py-0.5 rounded">start to finish</span></span>
          <span className="underline ml-1">Get Started</span>
        </Link>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 rounded-full transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
