'use client';

import Link from 'next/link';
import { X, Gift, Trophy } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function PromoBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
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

  if (!isClient || !isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-yellow-500 via-yellow-400 to-brand-green text-black relative">
      <div className="container mx-auto px-4 py-2">
        <Link href="/referral-rewards" className="flex items-center justify-center gap-2 text-sm md:text-base font-bold hover:opacity-80 transition-opacity">
          <Trophy className="w-5 h-5 animate-pulse" />
          <span className="hidden sm:inline">CUSTOMER REWARDS:</span>
          <span>Earn up to <span className="text-white bg-black px-2 py-0.5 rounded">$1,000</span> per referral!</span>
          <Gift className="w-5 h-5" />
          <span className="underline ml-1">Learn More</span>
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
