'use client';

import React, { useState } from 'react';

const SLIDES = [
  {
    label: 'BNI Presentation — March 2026',
    title: ['RIVER CITY', 'ROOFING SOLUTIONS'],
    subtitle: 'Technology That Protects Homeowners',
    body: 'How we use cutting-edge tools to deliver a better experience',
    badges: ['IKO ROOFPRO', 'Owens Corning Preferred', 'Boral Certified', 'BBB A+'],
    cta: null,
    type: 'title' as const,
    note: 'Good morning everyone. Last year, 47 hail storms hit within 10 miles of THIS building. Most homeowners had no idea.',
  },
  {
    label: 'Free Tool',
    title: ['STORM', 'CHECK'],
    subtitle: 'Free Storm Damage Risk Assessment',
    items: [
      'Homeowner enters their address',
      'We pull official National Weather Service hail & storm data',
      'Instant risk score with damage probability',
      'Identifies properties that need professional inspection',
    ],
    cta: { text: 'LIVE DEMO', href: '/check-my-address' },
    ctaNote: 'Demo: Enter "100 N Beaty St, Athens, AL 35611"',
    type: 'steps' as const,
    note: 'Here\'s how to spot a referral: when someone says "we had that bad storm" or "my insurance adjuster came out" — that\'s your cue.',
  },
  {
    label: 'Insurance Ready',
    title: ['STORM & HAIL', 'REPORT'],
    subtitle: 'Official Documentation Homeowners Can Trust',
    cards: [
      { head: 'NWS Verified', desc: 'Hail event data with dates, sizes, distances' },
      { head: 'HailRecon Data', desc: 'Historical database from 2011 to present' },
      { head: 'Risk Scoring', desc: 'Property-specific damage analysis' },
      { head: 'Claim Ready', desc: 'Official documentation for insurance' },
    ],
    cta: { text: 'VIEW SAMPLE REPORT', href: '/bni/report', blue: true },
    type: 'cards' as const,
    note: 'Insurance companies need this documentation. Most roofers show up with a ladder and a handshake. We show up with verified government data.',
  },
  {
    label: 'Your Referral Gets This',
    title: ['CUSTOMER', 'PORTAL'],
    subtitle: 'Complete Transparency From Inspection to Installation',
    cards: [
      { head: 'Job Progress', desc: 'Real-time status tracking' },
      { head: 'Messages', desc: 'Direct communication with your rep' },
      { head: 'Documents', desc: 'All paperwork in one place' },
      { head: 'Weather', desc: 'Live forecast for your area' },
      { head: 'Hail Report', desc: 'Storm data for your property' },
      { head: 'Payments', desc: 'Transparent billing & insurance' },
    ],
    cta: { text: 'VIEW PORTAL DEMO', href: '/bni/portal' },
    type: 'cards' as const,
    note: 'When you refer someone, THIS is the experience they get. No wondering, no phone tag, no surprises.',
  },
  {
    label: 'Design Tool',
    title: ['SEE YOUR NEW ROOF', 'BEFORE WE INSTALL IT'],
    subtitle: 'Our IKO Roof Visualizer lets you upload a photo of your home and try different shingle styles and colors',
    items: [
      'Upload your own home photo',
      'Try IKO Dynasty, Cambridge, and Nordic shingle lines',
      'See realistic color previews',
      'Choose your perfect look before committing',
    ],
    cta: { text: 'TRY IT NOW', href: 'https://www.rivercityroofingsolutions.com/roof-visualizer', blue: true },
    ctaNote: 'rivercityroofingsolutions.com/roof-visualizer',
    badge: 'IKO ROOFPRO Craftsman Premier',
    type: 'visualizer' as const,
    note: 'And here\'s the fun one — homeowners get to choose exactly what their roof looks like before we install it. As an IKO ROOFPRO Craftsman Premier contractor, we offer the full range of IKO shingle products.',
  },
  {
    label: 'My Specific Ask',
    title: ['HOW TO REFER:', 'LISTEN FOR THESE'],
    triggers: [
      '"We had that bad storm last month"',
      '"My insurance adjuster came out"',
      '"Our roof is getting old"',
      '"We\'re thinking about selling our home"',
    ],
    referral: {
      amount: '$200 Per Referral',
      instruction: 'Send a group text with me and the homeowner:',
      phone: '(256) 274-8530',
    },
    partner: {
      title: 'We Put YOU on Our Website',
      desc: 'Your business is listed on our partner page — our customers can find you too.',
      link: 'rivercityroofingsolutions.com/bni',
    },
    type: 'close' as const,
    note: 'I\'m looking for homeowners whose roof is over 15 years old, OR anyone who mentions storm damage. The easiest way to refer? Group text — 256-274-8530.',
  },
];

export default function BNIPresentationPage() {
  const [idx, setIdx] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  const total = SLIDES.length;
  const slide = SLIDES[idx];
  const go = (n: number) => { if (n >= 0 && n < total) setIdx(n); };
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black text-white overflow-hidden select-none flex flex-col outline-none"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(idx + 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
        else if (e.key === 'n' || e.key === 'N') setShowNotes(v => !v);
        else if (e.key === 'Escape') window.location.href = '/bni';
      }}
    >
      {/* Top bar */}
      <div className="h-1.5 bg-neutral-900 flex-shrink-0">
        <div className="h-full bg-[#39FF14] transition-all duration-300" style={{ width: `${((idx + 1) / total) * 100}%`, boxShadow: '0 0 12px #39FF14' }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0">
        <a href="/bni" className="text-[10px] text-neutral-600 hover:text-[#39FF14] font-black uppercase tracking-[0.3em] transition-colors">ESC Exit</a>
        <div className="text-[10px] text-neutral-600 font-black uppercase tracking-[0.3em]">Press N for Notes</div>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center px-8 md:px-16 lg:px-24 overflow-hidden">
        <div className="w-full max-w-5xl" key={idx}>

          {/* TITLE SLIDE */}
          {slide.type === 'title' && (
            <div className="text-center">
              <img src="/logo-nobg.png" alt="RCRS" className="w-56 md:w-72 lg:w-80 h-auto mx-auto mb-6 drop-shadow-2xl" />
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#39FF14] mb-6">{slide.label}</p>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-[0.15em] text-white mb-3">{slide.subtitle}</h2>
              <p className="text-neutral-400 mb-8 max-w-xl mx-auto">{slide.body}</p>
              <div className="flex flex-wrap justify-center gap-3">
                {slide.badges?.map(b => (
                  <span key={b} className="border-2 border-[#39FF14]/30 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#39FF14]">{b}</span>
                ))}
              </div>
            </div>
          )}

          {/* STEPS SLIDE */}
          {slide.type === 'steps' && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#39FF14] mb-3">{slide.label}</p>
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-[0.1em] mb-1">
                {slide.title[0]} <span className="text-[#39FF14]">{slide.title[1]}</span>
              </h1>
              <h2 className="text-lg md:text-xl text-neutral-400 uppercase tracking-wider mb-8">{slide.subtitle}</h2>
              <div className="space-y-3 mb-8">
                {slide.items?.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 bg-neutral-950 border-2 border-[#39FF14]/15 rounded-2xl px-6 py-4 hover:border-[#39FF14]/40 transition-colors">
                    <span className="text-[#39FF14] font-black text-sm w-8 flex-shrink-0">0{i + 1}</span>
                    <span className="text-neutral-200">{item}</span>
                  </div>
                ))}
              </div>
              {slide.cta && (
                <div>
                  <a href={slide.cta.href} target="_blank" rel="noopener noreferrer"
                    className="inline-block bg-[#39FF14] text-black font-black uppercase tracking-[0.15em] px-8 py-4 rounded-xl text-sm hover:shadow-[0_0_30px_rgba(57,255,20,0.4)] transition-all">
                    {slide.cta.text} &rarr;
                  </a>
                  {slide.ctaNote && <p className="text-neutral-600 text-xs mt-3 uppercase tracking-wider">{slide.ctaNote}</p>}
                </div>
              )}
            </div>
          )}

          {/* CARDS SLIDE */}
          {slide.type === 'cards' && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#39FF14] mb-3">{slide.label}</p>
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-[0.1em] mb-1">
                {slide.title[0]} <span className="text-[#39FF14]">{slide.title[1]}</span>
              </h1>
              <h2 className="text-lg md:text-xl text-neutral-400 uppercase tracking-wider mb-8">{slide.subtitle}</h2>
              <div className={`grid gap-4 mb-8 ${(slide.cards?.length || 0) > 4 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
                {slide.cards?.map((c, i) => (
                  <div key={i} className={`bg-neutral-950 border-2 rounded-2xl p-5 hover:shadow-[0_0_20px_rgba(57,255,20,0.08)] transition-all ${
                    slide.cta?.blue ? 'border-[#0066CC]/25 hover:border-[#0066CC]/50' : 'border-[#39FF14]/15 hover:border-[#39FF14]/40'
                  }`}>
                    <h3 className={`font-black uppercase tracking-[0.15em] text-xs mb-2 ${slide.cta?.blue ? 'text-[#0066CC]' : 'text-[#39FF14]'}`}>{c.head}</h3>
                    <p className="text-neutral-300 text-sm">{c.desc}</p>
                  </div>
                ))}
              </div>
              {slide.cta && (
                <a href={slide.cta.href} target="_blank" rel="noopener noreferrer"
                  className={`inline-block font-black uppercase tracking-[0.15em] px-8 py-4 rounded-xl text-sm transition-all ${
                    slide.cta.blue
                      ? 'bg-[#0066CC] text-white hover:shadow-[0_0_30px_rgba(0,102,204,0.4)]'
                      : 'bg-[#39FF14] text-black hover:shadow-[0_0_30px_rgba(57,255,20,0.4)]'
                  }`}>
                  {slide.cta.text} &rarr;
                </a>
              )}
            </div>
          )}

          {/* VISUALIZER SLIDE */}
          {slide.type === 'visualizer' && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#39FF14] mb-3">{slide.label}</p>
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-[0.1em] mb-1">
                {slide.title[0]} <span className="text-[#0066CC]">{slide.title[1]}</span>
              </h1>
              <h2 className="text-base md:text-lg text-neutral-400 tracking-wider mb-6 max-w-3xl">{slide.subtitle}</h2>

              <div className="flex flex-col md:flex-row gap-6 mb-6">
                {/* Visual: House with color swatches */}
                <div className="flex-shrink-0 w-full md:w-80">
                  <div className="relative bg-neutral-950 border-2 border-[#0066CC]/25 rounded-2xl p-6 overflow-hidden">
                    {/* House illustration */}
                    <div className="flex flex-col items-center">
                      {/* Roof */}
                      <div className="relative w-56 h-0 border-l-[112px] border-r-[112px] border-b-[60px] border-l-transparent border-r-transparent border-b-[#0066CC] mb-0">
                        <div className="absolute top-[20px] left-[-70px] text-[10px] font-black text-white/80 uppercase tracking-wider whitespace-nowrap">Your shingle color here</div>
                      </div>
                      {/* House body */}
                      <div className="w-56 h-28 bg-neutral-700 flex items-center justify-center relative">
                        <div className="w-10 h-16 bg-neutral-800 border-2 border-neutral-600 absolute bottom-0"></div>
                        <div className="w-8 h-8 bg-neutral-500/30 border-2 border-neutral-600 absolute left-6 top-4"></div>
                        <div className="w-8 h-8 bg-neutral-500/30 border-2 border-neutral-600 absolute right-6 top-4"></div>
                      </div>
                    </div>
                    {/* Color swatches */}
                    <div className="mt-4 flex justify-center gap-2">
                      {[
                        { color: '#2d2926', label: 'Charcoal' },
                        { color: '#5c4033', label: 'Brown' },
                        { color: '#1a1a2e', label: 'Black' },
                        { color: '#6b4c3b', label: 'Cedar' },
                        { color: '#4a5568', label: 'Slate' },
                      ].map((swatch) => (
                        <div key={swatch.label} className="flex flex-col items-center gap-1">
                          <div className="w-8 h-8 rounded-lg border-2 border-white/20 hover:border-[#39FF14] transition-colors cursor-pointer" style={{ backgroundColor: swatch.color }} />
                          <span className="text-[8px] text-neutral-500 uppercase">{swatch.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-center text-[10px] text-[#0066CC] font-black uppercase tracking-wider mt-3">Before &amp; After Preview</p>
                  </div>
                </div>

                {/* Selling points */}
                <div className="flex-1 space-y-3">
                  {slide.items?.map((item, i) => (
                    <div key={i} className="flex items-center gap-4 bg-neutral-950 border-2 border-[#0066CC]/15 rounded-2xl px-5 py-3 hover:border-[#0066CC]/40 transition-colors">
                      <span className="text-[#0066CC] font-black text-sm w-8 flex-shrink-0">0{i + 1}</span>
                      <span className="text-neutral-200">{item}</span>
                    </div>
                  ))}
                  {/* Badge */}
                  {slide.badge && (
                    <div className="flex items-center gap-3 mt-4 px-5 py-3 bg-[#0066CC]/10 border-2 border-[#0066CC]/30 rounded-2xl">
                      <svg className="w-5 h-5 text-[#0066CC] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      <span className="text-[#0066CC] font-black uppercase tracking-[0.15em] text-xs">{slide.badge}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* CTA */}
              {slide.cta && (
                <div>
                  <a href={slide.cta.href} target="_blank" rel="noopener noreferrer"
                    className="inline-block bg-[#0066CC] text-white font-black uppercase tracking-[0.15em] px-8 py-4 rounded-xl text-sm hover:shadow-[0_0_30px_rgba(0,102,204,0.4)] transition-all">
                    {slide.cta.text} &rarr;
                  </a>
                  {slide.ctaNote && <p className="text-neutral-500 text-xs mt-3 uppercase tracking-wider">{slide.ctaNote}</p>}
                </div>
              )}
            </div>
          )}

          {/* CLOSE SLIDE */}
          {slide.type === 'close' && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#39FF14] mb-3">{slide.label}</p>
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-[0.1em] mb-6">
                {slide.title[0]} <span className="text-[#39FF14]">{slide.title[1]}</span>
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                {slide.triggers?.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 bg-neutral-950 border-2 border-[#39FF14]/15 rounded-2xl px-5 py-4 hover:border-[#39FF14]/40 transition-colors">
                    <span className="text-[#39FF14] text-xl flex-shrink-0">&#x1F4AC;</span>
                    <span className="text-neutral-200 italic">{t}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="bg-[#39FF14]/10 border-2 border-[#39FF14]/50 rounded-2xl p-6 flex-1">
                  <h3 className="text-xl font-black uppercase tracking-[0.15em] text-[#39FF14] mb-2">{slide.referral?.amount}</h3>
                  <p className="text-neutral-300 text-sm mb-3">{slide.referral?.instruction}</p>
                  <a href="tel:2562748530" className="text-2xl font-black text-white hover:text-[#39FF14] transition-colors">{slide.referral?.phone}</a>
                </div>
                <div className="bg-neutral-950 border-2 border-[#0066CC]/30 rounded-2xl p-6 flex-1">
                  <h3 className="text-lg font-black uppercase tracking-[0.1em] text-white mb-2">{slide.partner?.title}</h3>
                  <p className="text-neutral-400 text-sm mb-3">{slide.partner?.desc}</p>
                  <a href="https://www.rivercityroofingsolutions.com/bni" target="_blank" rel="noopener noreferrer"
                    className="text-[#39FF14] font-black uppercase tracking-widest text-xs hover:underline">{slide.partner?.link} &rarr;</a>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-neutral-600 text-[10px] font-black uppercase tracking-[0.2em]">
                {['rcrs@rivercityroofingsolutions.com', 'IKO ROOFPRO', 'Owens Corning Preferred', 'Boral Certified', 'BBB A+'].map((s, i) => (
                  <span key={i} className="flex items-center gap-2">{i > 0 && <span className="text-[#39FF14]">&bull;</span>}{s}</span>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Speaker notes */}
      {showNotes && slide.note && (
        <div className="flex-shrink-0 mx-6 mb-2 px-5 py-4 bg-neutral-950/95 backdrop-blur-sm border-2 border-[#39FF14]/20 rounded-2xl">
          <span className="text-[#39FF14] font-black uppercase tracking-[0.2em] text-[10px] mr-3">Speaker Note</span>
          <span className="text-neutral-400 text-sm">{slide.note}</span>
        </div>
      )}

      {/* Bottom nav */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
        <button
          onClick={() => go(idx - 1)}
          disabled={idx === 0}
          className="w-10 h-10 rounded-full border-2 border-[#39FF14]/30 flex items-center justify-center disabled:opacity-20 hover:border-[#39FF14] hover:shadow-[0_0_12px_rgba(57,255,20,0.3)] transition-all"
        >
          <svg className="w-4 h-4 text-[#39FF14]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all ${i === idx ? 'w-8 bg-[#39FF14] shadow-[0_0_8px_#39FF14]' : 'w-2 bg-neutral-800 hover:bg-neutral-600'}`}
            />
          ))}
        </div>

        <button
          onClick={() => go(idx + 1)}
          disabled={idx === total - 1}
          className="w-10 h-10 rounded-full border-2 border-[#39FF14]/30 flex items-center justify-center disabled:opacity-20 hover:border-[#39FF14] hover:shadow-[0_0_12px_rgba(57,255,20,0.3)] transition-all"
        >
          <svg className="w-4 h-4 text-[#39FF14]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
