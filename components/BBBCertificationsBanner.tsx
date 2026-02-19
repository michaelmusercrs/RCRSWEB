'use client';

import { Shield, Award, Star, ExternalLink } from 'lucide-react';
import Image from 'next/image';

// =============================================================================
// Certification logos config — update paths as real logos are added
// =============================================================================

const CERTIFICATIONS = [
  { name: 'BBB A+ Rated', logo: '/images/certifications/bbb.png', alt: 'BBB A+ Accredited Business' },
  { name: 'Owens Corning', logo: '/images/certifications/owens-corning.png', alt: 'Owens Corning Preferred Contractor' },
  { name: 'IKO', logo: '/images/certifications/iko.png', alt: 'IKO Certified Installer' },
  { name: 'LeafX', logo: '/images/certifications/leafx.png', alt: 'LeafX Authorized Dealer' },
  { name: 'ProCat', logo: '/images/certifications/procat.png', alt: 'ProCat Certified' },
  { name: 'Boral', logo: '/images/certifications/boral.png', alt: 'Boral Certified Installer' },
];

const BEST_OF_BEST_YEARS = [2022, 2023, 2024, 2025];

// =============================================================================
// Full Banner (for homepage / about page)
// =============================================================================

export function BBBCertificationsBanner() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-950 to-black py-16">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-green rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* BBB A+ Rating - Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-blue-600/10 border border-blue-500/20 rounded-2xl mb-6">
            <Shield size={28} className="text-blue-400" />
            <div className="text-left">
              <div className="text-2xl font-bold text-white">A+ BBB Rating</div>
              <div className="text-xs text-blue-300">Better Business Bureau Accredited</div>
            </div>
          </div>

          {/* Best of the Best */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <Award size={24} className="text-amber-400" />
              <h3 className="text-xl font-bold text-white">
                &ldquo;Best of the Best of the Tennessee Valley&rdquo;
              </h3>
              <Award size={24} className="text-amber-400" />
            </div>
            <div className="flex items-center justify-center gap-3">
              {BEST_OF_BEST_YEARS.map(year => (
                <span
                  key={year}
                  className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 font-bold text-lg"
                >
                  {year}
                </span>
              ))}
            </div>
            <p className="text-amber-400/60 text-sm mt-2 font-medium">4 Years in a Row!</p>
          </div>
        </div>

        {/* Certification Logos */}
        <div className="flex flex-wrap items-center justify-center gap-8 max-w-4xl mx-auto">
          {CERTIFICATIONS.map(cert => (
            <div
              key={cert.name}
              className="flex flex-col items-center gap-2 p-4 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/[0.06] transition-colors"
            >
              <div className="w-16 h-16 bg-white/10 rounded-lg flex items-center justify-center">
                {/* Placeholder until real logos are added */}
                <Shield size={28} className="text-neutral-400" />
              </div>
              <span className="text-[11px] text-neutral-400 font-medium text-center">{cert.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// Compact Badge (for sidebar / footer / cards)
// =============================================================================

export function BBBBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-lg ${className}`}>
      <Shield size={16} className="text-blue-400" />
      <span className="text-xs font-bold text-blue-300">A+ BBB Rated</span>
    </div>
  );
}

export function BestOfBestBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg ${className}`}>
      <Award size={14} className="text-amber-400" />
      <span className="text-xs font-bold text-amber-300">&ldquo;Best of the Best&rdquo; 4x Winner</span>
    </div>
  );
}
