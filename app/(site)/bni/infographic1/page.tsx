'use client';

import { useEffect } from 'react';

export default function StormCheckInfographicPage() {
  useEffect(() => {
    document.title = 'How StormCheck Works - River City Roofing Solutions';
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-black via-neutral-900 to-black overflow-auto">
      {/* Print styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .fixed { position: relative !important; }
          * { animation: none !important; }
        }
        @keyframes pulse-glow {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(57, 255, 20, 0.3)); transform: scale(1); }
          50% { filter: drop-shadow(0 0 16px rgba(57, 255, 20, 0.6)); transform: scale(1.04); }
        }
        @keyframes dash-flow {
          to { stroke-dashoffset: -20; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .icon-pulse { animation: pulse-glow 3s ease-in-out infinite; }
        .icon-pulse-delay-1 { animation: pulse-glow 3s ease-in-out 0.5s infinite; }
        .icon-pulse-delay-2 { animation: pulse-glow 3s ease-in-out 1s infinite; }
        .icon-pulse-delay-3 { animation: pulse-glow 3s ease-in-out 1.5s infinite; }
        .dash-animate { animation: dash-flow 0.8s linear infinite; }
      `}</style>

      {/* Dot grid background overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle, #39FF14 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Content wrapper */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Back link */}
        <a
          href="/bni/present"
          className="no-print inline-flex items-center gap-1.5 text-neutral-600 hover:text-neutral-400 text-xs tracking-wide transition-colors mb-6"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </a>

        {/* ═══════════ HERO ═══════════ */}
        <header className="text-center mb-12 sm:mb-16">
          {/* Logo text */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="h-px w-10 sm:w-16 bg-gradient-to-r from-transparent to-[#39FF14]/40" />
            <p className="text-[10px] sm:text-xs tracking-[0.35em] uppercase text-neutral-400 font-medium">
              <span className="text-neutral-500">River City</span>{' '}
              <span className="text-[#39FF14] font-bold">Roofing</span>{' '}
              <span className="text-neutral-500">Solutions</span>
            </p>
            <div className="h-px w-10 sm:w-16 bg-gradient-to-l from-transparent to-[#39FF14]/40" />
          </div>

          {/* Decorative roof icon */}
          <div className="flex justify-center mb-5">
            <svg width="48" height="32" viewBox="0 0 48 32" fill="none" className="opacity-40">
              <path d="M24 2L2 22h8v8h28v-8h8L24 2z" stroke="#39FF14" strokeWidth="1.5" fill="none" />
              <path d="M18 30v-8h12v8" stroke="#39FF14" strokeWidth="1.5" fill="none" />
            </svg>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-4">
            How{' '}
            <span className="relative">
              <span className="text-[#39FF14]">StormCheck</span>
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#39FF14]/50 to-transparent" />
            </span>{' '}
            Protects
            <br className="hidden sm:block" /> Your Property
          </h1>
          <p className="text-neutral-400 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Free storm damage risk assessment powered by{' '}
            <span className="text-neutral-300 font-medium">official weather data</span>
          </p>
        </header>

        {/* ═══════════ PROCESS FLOW ═══════════ */}
        <section className="mb-16 sm:mb-20">
          {/* Section label */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-[#39FF14]/20 to-transparent" />
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#39FF14]/60 font-semibold shrink-0">
              How It Works
            </p>
            <div className="h-px flex-1 bg-gradient-to-l from-[#39FF14]/20 to-transparent" />
          </div>

          {/* Steps grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-3 lg:gap-4 relative">
            {/* Connecting lines - desktop only */}
            <div className="hidden md:block absolute top-[72px] left-[calc(25%-12px)] right-[calc(25%-12px)] z-0">
              <svg width="100%" height="4" className="overflow-visible">
                <line
                  x1="0" y1="2" x2="100%" y2="2"
                  stroke="#39FF14"
                  strokeWidth="2"
                  strokeDasharray="6 6"
                  className="dash-animate"
                  strokeOpacity="0.3"
                />
              </svg>
            </div>

            {/* Step 1 */}
            <div className="relative z-10 group">
              <div className="bg-neutral-800/60 backdrop-blur border border-neutral-700 rounded-2xl p-6 lg:p-8 text-center hover:border-[#39FF14]/30 transition-all duration-500 h-full flex flex-col items-center hover:bg-neutral-800/80 hover:shadow-[0_0_40px_rgba(57,255,20,0.05)]">
                {/* Step number */}
                <div className="w-8 h-8 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/30 flex items-center justify-center mb-4">
                  <span className="text-[#39FF14] text-sm font-bold">1</span>
                </div>
                {/* Icon */}
                <div className="mb-5 icon-pulse">
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    {/* House shape */}
                    <path d="M28 10L8 26h6v16h12v-10h4v10h12V26h6L28 10z" stroke="#39FF14" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
                    {/* Map pin */}
                    <circle cx="40" cy="16" r="6" stroke="#0066CC" strokeWidth="1.5" fill="#0066CC" fillOpacity="0.15" />
                    <circle cx="40" cy="14.5" r="2" fill="#0066CC" fillOpacity="0.6" />
                    <path d="M40 22l-2.5-4h5L40 22z" fill="#0066CC" fillOpacity="0.4" />
                  </svg>
                </div>
                <h3 className="text-white text-base lg:text-lg font-bold mb-2">Enter Your Address</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  Homeowner enters their property address into our free online tool
                </p>
              </div>
              {/* Mobile connector */}
              <div className="md:hidden flex justify-center py-2">
                <svg width="4" height="32" viewBox="0 0 4 32">
                  <line x1="2" y1="0" x2="2" y2="32" stroke="#39FF14" strokeWidth="2" strokeDasharray="5 5" className="dash-animate" strokeOpacity="0.3" />
                </svg>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative z-10 group">
              <div className="bg-neutral-800/60 backdrop-blur border border-neutral-700 rounded-2xl p-6 lg:p-8 text-center hover:border-[#39FF14]/30 transition-all duration-500 h-full flex flex-col items-center hover:bg-neutral-800/80 hover:shadow-[0_0_40px_rgba(57,255,20,0.05)]">
                <div className="w-8 h-8 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/30 flex items-center justify-center mb-4">
                  <span className="text-[#39FF14] text-sm font-bold">2</span>
                </div>
                <div className="mb-5 icon-pulse-delay-1">
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    {/* Cloud */}
                    <path d="M14 34a8 8 0 01-.5-16A12 12 0 0137 16a8 8 0 01-1 16H14z" stroke="#39FF14" strokeWidth="1.8" fill="none" />
                    {/* Database cylinder */}
                    <ellipse cx="40" cy="36" rx="8" ry="3" stroke="#0066CC" strokeWidth="1.3" fill="#0066CC" fillOpacity="0.1" />
                    <path d="M32 36v10c0 1.66 3.58 3 8 3s8-1.34 8-3V36" stroke="#0066CC" strokeWidth="1.3" fill="none" />
                    <path d="M32 41c0 1.66 3.58 3 8 3s8-1.34 8-3" stroke="#0066CC" strokeWidth="1" fill="none" strokeOpacity="0.5" />
                    {/* Download arrows */}
                    <path d="M20 36v6m-2.5-2.5L20 42l2.5-2.5" stroke="#39FF14" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.5" />
                    <path d="M28 38v5m-2-2l2 2 2-2" stroke="#39FF14" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.5" />
                  </svg>
                </div>
                <h3 className="text-white text-base lg:text-lg font-bold mb-2">We Pull Official Data</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  Real-time NWS storm reports, HailRecon database, and weather alerts
                </p>
              </div>
              <div className="md:hidden flex justify-center py-2">
                <svg width="4" height="32" viewBox="0 0 4 32">
                  <line x1="2" y1="0" x2="2" y2="32" stroke="#39FF14" strokeWidth="2" strokeDasharray="5 5" className="dash-animate" strokeOpacity="0.3" />
                </svg>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative z-10 group">
              <div className="bg-neutral-800/60 backdrop-blur border border-neutral-700 rounded-2xl p-6 lg:p-8 text-center hover:border-[#39FF14]/30 transition-all duration-500 h-full flex flex-col items-center hover:bg-neutral-800/80 hover:shadow-[0_0_40px_rgba(57,255,20,0.05)]">
                <div className="w-8 h-8 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/30 flex items-center justify-center mb-4">
                  <span className="text-[#39FF14] text-sm font-bold">3</span>
                </div>
                <div className="mb-5 icon-pulse-delay-2">
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    {/* Gauge outer ring */}
                    <path d="M12 38a18 18 0 0136 0" stroke="#39FF14" strokeWidth="2" fill="none" strokeLinecap="round" />
                    {/* Gauge ticks */}
                    <path d="M14 36l3 1" stroke="#39FF14" strokeWidth="1" strokeOpacity="0.3" strokeLinecap="round" />
                    <path d="M18 28l2 2" stroke="#39FF14" strokeWidth="1" strokeOpacity="0.4" strokeLinecap="round" />
                    <path d="M24 22l1 2.5" stroke="#39FF14" strokeWidth="1" strokeOpacity="0.5" strokeLinecap="round" />
                    <path d="M30 20l0 3" stroke="#39FF14" strokeWidth="1" strokeOpacity="0.6" strokeLinecap="round" />
                    <path d="M36 22l-1 2.5" stroke="#39FF14" strokeWidth="1" strokeOpacity="0.7" strokeLinecap="round" />
                    <path d="M42 28l-2 2" stroke="#39FF14" strokeWidth="1" strokeOpacity="0.8" strokeLinecap="round" />
                    <path d="M46 36l-3 1" stroke="#39FF14" strokeWidth="1" strokeOpacity="0.9" strokeLinecap="round" />
                    {/* Needle */}
                    <line x1="30" y1="38" x2="40" y2="27" stroke="#0066CC" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="30" cy="38" r="3" fill="#0066CC" fillOpacity="0.3" stroke="#0066CC" strokeWidth="1.2" />
                    {/* Chart bars below */}
                    <rect x="16" y="44" width="4" height="6" rx="1" fill="#39FF14" fillOpacity="0.15" stroke="#39FF14" strokeWidth="0.5" strokeOpacity="0.3" />
                    <rect x="22" y="42" width="4" height="8" rx="1" fill="#39FF14" fillOpacity="0.25" stroke="#39FF14" strokeWidth="0.5" strokeOpacity="0.4" />
                    <rect x="28" y="40" width="4" height="10" rx="1" fill="#39FF14" fillOpacity="0.35" stroke="#39FF14" strokeWidth="0.5" strokeOpacity="0.5" />
                    <rect x="34" y="43" width="4" height="7" rx="1" fill="#39FF14" fillOpacity="0.2" stroke="#39FF14" strokeWidth="0.5" strokeOpacity="0.35" />
                    <rect x="40" y="45" width="4" height="5" rx="1" fill="#39FF14" fillOpacity="0.1" stroke="#39FF14" strokeWidth="0.5" strokeOpacity="0.25" />
                  </svg>
                </div>
                <h3 className="text-white text-base lg:text-lg font-bold mb-2">Risk Assessment Generated</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  Property-specific risk score with verified hail history and damage probability
                </p>
              </div>
              <div className="md:hidden flex justify-center py-2">
                <svg width="4" height="32" viewBox="0 0 4 32">
                  <line x1="2" y1="0" x2="2" y2="32" stroke="#39FF14" strokeWidth="2" strokeDasharray="5 5" className="dash-animate" strokeOpacity="0.3" />
                </svg>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative z-10 group">
              <div className="bg-neutral-800/60 backdrop-blur border border-neutral-700 rounded-2xl p-6 lg:p-8 text-center hover:border-[#39FF14]/30 transition-all duration-500 h-full flex flex-col items-center hover:bg-neutral-800/80 hover:shadow-[0_0_40px_rgba(57,255,20,0.05)]">
                <div className="w-8 h-8 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/30 flex items-center justify-center mb-4">
                  <span className="text-[#39FF14] text-sm font-bold">4</span>
                </div>
                <div className="mb-5 icon-pulse-delay-3">
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    {/* Clipboard */}
                    <rect x="14" y="12" width="28" height="36" rx="3" stroke="#39FF14" strokeWidth="1.8" fill="none" />
                    <rect x="22" y="8" width="12" height="8" rx="2" stroke="#39FF14" strokeWidth="1.4" fill="black" />
                    <circle cx="28" cy="12" r="1.5" fill="#39FF14" fillOpacity="0.5" />
                    {/* Checklist lines */}
                    <path d="M20 26l2.5 2.5L27 24" stroke="#39FF14" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="30" y1="26" x2="38" y2="26" stroke="white" strokeWidth="1" strokeOpacity="0.3" strokeLinecap="round" />
                    <path d="M20 34l2.5 2.5L27 32" stroke="#39FF14" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="30" y1="34" x2="38" y2="34" stroke="white" strokeWidth="1" strokeOpacity="0.3" strokeLinecap="round" />
                    <path d="M20 42l2.5 2.5L27 40" stroke="#0066CC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="30" y1="42" x2="36" y2="42" stroke="white" strokeWidth="1" strokeOpacity="0.2" strokeLinecap="round" />
                  </svg>
                </div>
                <h3 className="text-white text-base lg:text-lg font-bold mb-2">Professional Inspection</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  High-risk properties get a free professional roof inspection and detailed report
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ KEY STATS ═══════════ */}
        <section className="mb-16 sm:mb-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-[#39FF14]/20 to-transparent" />
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#39FF14]/60 font-semibold shrink-0">
              By The Numbers
            </p>
            <div className="h-px flex-1 bg-gradient-to-l from-[#39FF14]/20 to-transparent" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {[
              { value: '15+', label: 'Years of Hail Data' },
              { value: '100%', label: 'Official NWS Sourced' },
              { value: '50 mi', label: 'Search Radius' },
              { value: '47', label: 'Events Tracked Locally' },
              { value: '0', label: 'Cost to Homeowners' },
              { value: '24/7', label: 'Available Online' },
            ].map((stat, i) => (
              <div
                key={i}
                className="relative bg-neutral-800/40 backdrop-blur border border-neutral-700/60 rounded-2xl p-5 sm:p-6 text-center group hover:border-[#39FF14]/20 transition-all duration-500 overflow-hidden"
              >
                {/* Subtle top accent line */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-transparent via-[#39FF14]/30 to-transparent" />
                <p className="text-4xl sm:text-5xl md:text-5xl lg:text-4xl xl:text-5xl font-black text-[#39FF14] leading-none mb-2 tracking-tight">
                  {stat.value}
                </p>
                <p className="text-[10px] sm:text-xs text-neutral-400 uppercase tracking-wider font-medium leading-snug">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ DATA SOURCES ═══════════ */}
        <section className="mb-14 sm:mb-18">
          <div className="bg-neutral-800/30 backdrop-blur border border-neutral-700/40 rounded-2xl px-6 py-5 sm:px-8 sm:py-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <p className="text-[10px] tracking-[0.25em] uppercase text-neutral-500 font-semibold shrink-0">
                Powered by
              </p>
              <div className="hidden sm:block w-px h-6 bg-neutral-700" />
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:gap-x-8">
                {[
                  { name: 'National Weather Service', icon: (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
                      <circle cx="10" cy="10" r="8" stroke="#0066CC" strokeWidth="1.2" fill="none" />
                      <path d="M10 4v4l3 3" stroke="#0066CC" strokeWidth="1.2" strokeLinecap="round" />
                      <circle cx="10" cy="10" r="1" fill="#0066CC" />
                    </svg>
                  )},
                  { name: 'Storm Prediction Center', icon: (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
                      <path d="M10 2l2 6h6l-5 3.5 2 6.5-5-4-5 4 2-6.5L2 8h6l2-6z" stroke="#0066CC" strokeWidth="1.2" fill="none" />
                    </svg>
                  )},
                  { name: 'HailRecon Database', icon: (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
                      <circle cx="7" cy="12" r="2.5" stroke="#0066CC" strokeWidth="1.2" fill="none" />
                      <circle cx="13" cy="8" r="2" stroke="#0066CC" strokeWidth="1" fill="none" />
                      <circle cx="14" cy="14" r="1.5" stroke="#0066CC" strokeWidth="1" fill="none" />
                      <path d="M4 4l2 3M12 3l1 3M16 6l-1 2" stroke="#0066CC" strokeWidth="0.8" strokeOpacity="0.5" />
                    </svg>
                  )},
                  { name: 'Iowa State Mesonet', icon: (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
                      <rect x="3" y="6" width="14" height="10" rx="1.5" stroke="#0066CC" strokeWidth="1.2" fill="none" />
                      <path d="M3 10h14M10 6v10" stroke="#0066CC" strokeWidth="0.8" strokeOpacity="0.4" />
                      <circle cx="6" cy="8" r="0.8" fill="#0066CC" fillOpacity="0.6" />
                      <circle cx="13" cy="13" r="0.8" fill="#0066CC" fillOpacity="0.6" />
                    </svg>
                  )},
                ].map((source, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {source.icon}
                    <span className="text-neutral-400 text-xs sm:text-sm font-medium whitespace-nowrap">
                      {source.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ BOTTOM CTA ═══════════ */}
        <footer className="text-center pb-8 sm:pb-12">
          {/* Divider */}
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#39FF14]/15 to-transparent" />
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[#39FF14]/30">
              <path d="M10 2L2 10l8 8 8-8-8-8z" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#39FF14]/15 to-transparent" />
          </div>

          <p className="text-neutral-500 text-xs uppercase tracking-[0.2em] mb-4 font-medium">
            Check Your Address Free
          </p>

          <a
            href="/check-my-address"
            className="inline-block group"
          >
            <div className="relative bg-gradient-to-r from-[#39FF14]/10 via-[#39FF14]/5 to-[#39FF14]/10 border border-[#39FF14]/30 rounded-2xl px-8 sm:px-12 py-5 sm:py-6 hover:border-[#39FF14]/60 transition-all duration-500 hover:shadow-[0_0_60px_rgba(57,255,20,0.1)]">
              <p className="text-[#39FF14] text-lg sm:text-xl md:text-2xl font-bold tracking-wide mb-1">
                rivercityroofingsolutions.com/check-my-address
              </p>
              <p className="text-neutral-400 text-sm">
                Free instant storm risk assessment for your property
              </p>
            </div>
          </a>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-neutral-500 text-sm">
            <a href="tel:2562748530" className="flex items-center gap-2 hover:text-neutral-300 transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 2h3l1.5 3.5L5.8 7c.8 1.6 2 2.8 3.5 3.5l1.5-1.7L14 10.3v3C14 14.2 13.2 15 12.3 15 6.5 14.3 1.7 9.5 1 3.7 1 2.8 1.8 2 3 2z" stroke="currentColor" strokeWidth="1.2" fill="none" />
              </svg>
              (256) 274-8530
            </a>
            <span className="hidden sm:block text-neutral-700">|</span>
            <span className="text-neutral-600 text-xs">
              Huntsville &bull; Madison &bull; Decatur &bull; Athens
            </span>
          </div>

          {/* Bottom brand */}
          <div className="mt-8 pt-6 border-t border-neutral-800/60">
            <p className="text-[9px] tracking-[0.4em] uppercase text-neutral-600 font-medium">
              <span>River City</span>{' '}
              <span className="text-[#39FF14]/40">Roofing</span>{' '}
              <span>Solutions</span>
              <span className="mx-2 text-neutral-800">|</span>
              <span>Licensed &bull; Insured &bull; Trusted</span>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}