'use client';

import { useEffect, useState } from 'react';

/* ─────────────── data ─────────────── */

const timeline = [
  {
    step: 1,
    icon: 'inspect',
    title: 'Free Inspection',
    desc: 'Our certified inspector evaluates your roof and documents any damage with photos.',
    tag: 'Day 1',
  },
  {
    step: 2,
    icon: 'storm',
    title: 'Storm Report',
    desc: 'We pull official NWS hail data and generate a property-specific risk assessment.',
    tag: 'Day 1–2',
  },
  {
    step: 3,
    icon: 'insurance',
    title: 'Insurance Claim',
    desc: 'We handle all paperwork and meet with your insurance adjuster on your behalf.',
    tag: 'Day 2–5',
  },
  {
    step: 4,
    icon: 'approved',
    title: 'Claim Approved',
    desc: 'Once approved, we review the scope of work and you sign the contract.',
    tag: 'Week 2–4',
  },
  {
    step: 5,
    icon: 'choose',
    title: 'Choose Your Roof',
    desc: 'Use our IKO Visualizer to see exactly what your new roof will look like.',
    tag: 'Week 3–5',
  },
  {
    step: 6,
    icon: 'materials',
    title: 'Materials Ordered',
    desc: 'Premium IKO Dynasty shingles ordered and delivery scheduled.',
    tag: 'Week 4–6',
  },
  {
    step: 7,
    icon: 'install',
    title: 'Installation Day',
    desc: 'Professional crew completes your roof replacement, typically in one day.',
    tag: 'Scheduled',
  },
  {
    step: 8,
    icon: 'complete',
    title: 'Project Complete',
    desc: 'Final walkthrough, cleanup, and backed by manufacturer warranty.',
    tag: 'Complete',
  },
];

const features = [
  {
    icon: 'progress',
    title: 'Real-Time Progress',
    desc: 'Track your project status from inspection to completion. See exactly where things stand.',
  },
  {
    icon: 'chat',
    title: 'Direct Messaging',
    desc: 'Message your sales rep directly. Get fast answers without phone tag.',
  },
  {
    icon: 'docs',
    title: 'All Documents',
    desc: 'Inspection reports, insurance docs, contracts — everything in one secure place.',
  },
  {
    icon: 'weather',
    title: 'Weather Tracking',
    desc: 'Live forecast for your installation date. Know if weather will affect your schedule.',
  },
  {
    icon: 'hail',
    title: 'Hail History',
    desc: 'Full historical hail data for your property from NWS and HailRecon databases.',
  },
  {
    icon: 'billing',
    title: 'Billing & Payments',
    desc: 'See your insurance coverage, deductible, and payment status transparently.',
  },
];

const trustItems = [
  { icon: 'shield', label: 'IKO RoofPro Certified' },
  { icon: 'badge', label: 'Fully Licensed & Insured' },
  { icon: 'star', label: '5-Star Google Rating' },
];

/* ─────────────── SVG icons ─────────────── */

function Icon({ name, size = 28 }: { name: string; size?: number }) {
  const s = size;
  const shared = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (name) {
    /* timeline */
    case 'inspect':
      return <svg {...shared}><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>;
    case 'storm':
      return <svg {...shared}><path d="M18 10a6 6 0 00-12 0c-2.2.5-4 2.5-4 5a5 5 0 005 5h10a5 5 0 001-9.9z"/><path d="M13 12l-2 5h3l-2 5"/></svg>;
    case 'insurance':
      return <svg {...shared}><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>;
    case 'approved':
      return <svg {...shared}><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>;
    case 'choose':
      return <svg {...shared}><circle cx="13.5" cy="6.5" r="2.5"/><path d="M3 20c0 0 3-8 9-8s9 8 9 8"/><path d="M17 10l3 3-3 3"/></svg>;
    case 'materials':
      return <svg {...shared}><path d="M12 3l9 4.5v9L12 21l-9-4.5v-9L12 3z"/><path d="M12 12l9-4.5"/><path d="M12 12v9"/><path d="M12 12L3 7.5"/></svg>;
    case 'install':
      return <svg {...shared}><path d="M14 2l-4 8h6l-4 8"/><path d="M5 18h14"/><path d="M7 22h10"/></svg>;
    case 'complete':
      return <svg {...shared}><path d="M3 10l2-2 4 0 3-5 3 5h4l2 2-1 4 3 3-3 3 1 4"/><path d="M9 13l2 2 4-4"/></svg>;

    /* features */
    case 'progress':
      return <svg {...shared}><rect x="2" y="6" width="20" height="12" rx="3"/><rect x="4" y="9" width="10" height="6" rx="1.5" fill="currentColor" opacity=".35"/><path d="M16 12h2"/></svg>;
    case 'chat':
      return <svg {...shared}><path d="M21 12a9 9 0 01-9 9c-1.8 0-3.5-.5-5-1.4L3 21l1.4-4A9 9 0 0112 3a9 9 0 019 9z"/><circle cx="8" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="16" cy="12" r="1" fill="currentColor"/></svg>;
    case 'docs':
      return <svg {...shared}><path d="M4 4a2 2 0 012-2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/><path d="M14 2v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/></svg>;
    case 'weather':
      return <svg {...shared}><circle cx="12" cy="8" r="4"/><path d="M12 1v1"/><path d="M12 15v1"/><path d="M4.93 4.93l.7.7"/><path d="M18.36 18.36l.7.7"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.93 19.07l.7-.7"/><path d="M18.36 5.64l.7-.7"/><path d="M16 18a4 4 0 00-8 0"/></svg>;
    case 'hail':
      return <svg {...shared}><path d="M20 17a4 4 0 00-1-7.9 6 6 0 00-11.3-1A5 5 0 006 17"/><circle cx="8" cy="20" r="1" fill="currentColor"/><circle cx="12" cy="22" r="1" fill="currentColor"/><circle cx="16" cy="20" r="1" fill="currentColor"/><circle cx="10" cy="18" r="1" fill="currentColor"/><circle cx="14" cy="18" r="1" fill="currentColor"/></svg>;
    case 'billing':
      return <svg {...shared}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M7 15h4"/><path d="M15 15h2"/></svg>;

    /* trust */
    case 'shield':
      return <svg {...shared}><path d="M12 2l8 4v6c0 5.5-3.8 10-8 12-4.2-2-8-6.5-8-12V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>;
    case 'badge':
      return <svg {...shared}><circle cx="12" cy="9" r="6"/><path d="M8.5 15.5L7 22l5-3 5 3-1.5-6.5"/><path d="M9 9l2 2 4-4"/></svg>;
    case 'star':
      return <svg {...shared}><polygon points="12,2 15.1,8.3 22,9.2 17,14 18.2,21 12,17.7 5.8,21 7,14 2,9.2 8.9,8.3" fill="currentColor" opacity=".25"/><polygon points="12,2 15.1,8.3 22,9.2 17,14 18.2,21 12,17.7 5.8,21 7,14 2,9.2 8.9,8.3"/></svg>;

    default:
      return <svg {...shared}><circle cx="12" cy="12" r="9"/></svg>;
  }
}

/* ─────────────── component ─────────────── */

export default function Infographic2Page() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    document.title = 'The Customer Experience | River City Roofing Solutions';
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-[#0a0a0f] via-[#0d1117] to-[#0a0a0f] overflow-auto">
      {/* dotted grid background */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(57,255,20,0.04) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* top-left radial glow */}
      <div className="pointer-events-none fixed -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#39FF14]/[0.03] blur-[120px]" />
      {/* bottom-right radial glow */}
      <div className="pointer-events-none fixed -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#0066CC]/[0.04] blur-[120px]" />

      <div className={`relative z-10 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* ── back link ── */}
        <div className="max-w-5xl mx-auto px-6 pt-5">
          <a
            href="/bni/present"
            className="inline-flex items-center gap-1.5 text-xs text-white/25 hover:text-white/50 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            Back
          </a>
        </div>

        {/* ══════════════════ HERO ══════════════════ */}
        <header className="text-center pt-10 pb-16 px-6">
          {/* logo branding bar */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-[#39FF14]/60" />
            <span className="text-[11px] font-bold tracking-[0.35em] text-[#39FF14]/80 uppercase">
              River City Roofing Solutions
            </span>
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-[#39FF14]/60" />
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
            The Customer{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#39FF14] to-[#00cc66]">
              Experience
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
            From first contact to completed roof — complete transparency at every step
          </p>

          {/* decorative divider */}
          <div className="mt-10 flex items-center justify-center gap-2">
            <span className="h-1 w-1 rounded-full bg-[#39FF14]/40" />
            <span className="h-1 w-8 rounded-full bg-[#39FF14]/30" />
            <span className="h-1 w-1 rounded-full bg-[#39FF14]/40" />
          </div>
        </header>

        {/* ══════════════════ TIMELINE ══════════════════ */}
        <section className="max-w-4xl mx-auto px-6 pb-24">
          <h2 className="text-center text-xs font-bold tracking-[0.3em] uppercase text-white/30 mb-2">
            Your Journey
          </h2>
          <p className="text-center text-2xl sm:text-3xl font-bold text-white mb-14">
            8 Steps to a New Roof
          </p>

          {/* timeline */}
          <div className="relative">
            {/* vertical line */}
            <div className="absolute left-6 sm:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#39FF14] via-[#39FF14] to-neutral-700 sm:-translate-x-px" />

            {timeline.map((item, i) => {
              const isLeft = i % 2 === 0;
              return (
                <div key={item.step} className="relative mb-12 last:mb-0">
                  {/* node dot */}
                  <div
                    className={`
                      absolute z-20 left-6 sm:left-1/2 -translate-x-1/2
                      w-4 h-4 rounded-full
                      ${i < 6
                        ? 'bg-[#39FF14] ring-4 ring-[#39FF14]/20 shadow-[0_0_12px_rgba(57,255,20,0.35)]'
                        : 'bg-[#39FF14]/60 ring-4 ring-[#39FF14]/10 shadow-[0_0_20px_rgba(57,255,20,0.15)] animate-pulse'
                      }
                    `}
                    style={{ top: '1.7rem' }}
                  />

                  {/* card — mobile: all right; desktop: alternating */}
                  <div
                    className={`
                      ml-14 sm:ml-0
                      sm:w-[calc(50%-2.5rem)]
                      ${isLeft ? 'sm:mr-auto sm:pr-0' : 'sm:ml-auto sm:pl-0'}
                    `}
                  >
                    <div className="group bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-2xl p-5 sm:p-6 hover:border-[#39FF14]/20 transition-all duration-500 hover:bg-white/[0.05]">
                      {/* tag + icon row */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#39FF14]/10 text-[#39FF14] flex-shrink-0">
                          <Icon name={item.icon} size={22} />
                        </span>
                        <div>
                          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#39FF14]/60 block leading-none mb-1">
                            {item.tag}
                          </span>
                          <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                            <span className="text-[#39FF14]/40 mr-1.5 font-black text-sm">
                              {String(item.step).padStart(2, '0')}
                            </span>
                            {item.title}
                          </h3>
                        </div>
                      </div>
                      <p className="text-sm text-white/45 leading-relaxed pl-[52px]">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ══════════════════ PORTAL FEATURES ══════════════════ */}
        <section className="relative py-24 px-6">
          {/* section glow */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#0066CC]/[0.03] to-transparent" />

          <div className="relative max-w-5xl mx-auto">
            <h2 className="text-center text-xs font-bold tracking-[0.3em] uppercase text-[#0066CC]/60 mb-2">
              Customer Portal
            </h2>
            <p className="text-center text-2xl sm:text-3xl font-bold text-white mb-4">
              Your Personal Dashboard
            </p>
            <p className="text-center text-sm text-white/40 max-w-xl mx-auto mb-14">
              Every customer gets a secure online portal with real-time access to their project details
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group bg-white/[0.04] backdrop-blur border border-white/[0.08] rounded-2xl p-6 hover:border-[#39FF14]/30 transition-all duration-500 hover:bg-white/[0.06] hover:shadow-[0_0_30px_rgba(57,255,20,0.04)]"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#39FF14]/15 to-[#0066CC]/10 flex items-center justify-center text-[#39FF14] mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Icon name={f.icon} size={22} />
                  </div>
                  <h3 className="text-[15px] font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════ TRUST BAR ══════════════════ */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {trustItems.map((t) => (
                <div
                  key={t.label}
                  className="flex items-center justify-center gap-3 bg-[#39FF14]/[0.06] border border-[#39FF14]/20 rounded-xl px-6 py-4 hover:bg-[#39FF14]/[0.1] transition-colors duration-300"
                >
                  <span className="text-[#39FF14]">
                    <Icon name={t.icon} size={22} />
                  </span>
                  <span className="text-sm font-semibold text-white/80">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════ CTA ══════════════════ */}
        <section className="pb-20 pt-8 px-6">
          <div className="max-w-3xl mx-auto text-center">
            {/* decorative divider */}
            <div className="flex items-center justify-center gap-2 mb-10">
              <span className="h-px w-20 bg-gradient-to-r from-transparent to-white/10" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#39FF14]/30" />
              <span className="h-px w-20 bg-gradient-to-l from-transparent to-white/10" />
            </div>

            <p className="text-xl sm:text-2xl font-bold text-white mb-8">
              Ready to see your roof project come to life?
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <a
                href="/bni/portal"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#39FF14] text-[#0a0a0f] font-bold text-sm hover:shadow-[0_0_30px_rgba(57,255,20,0.3)] transition-all duration-300 hover:scale-105"
              >
                See It In Action
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
              </a>
              <a
                href="/check-my-address"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white/[0.06] border border-white/10 text-white font-semibold text-sm hover:border-[#39FF14]/30 hover:bg-white/[0.1] transition-all duration-300"
              >
                Check Your Address
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </a>
            </div>

            {/* phone */}
            <a
              href="tel:+12562748530"
              className="inline-flex items-center gap-2 text-white/40 hover:text-[#39FF14] transition-colors text-sm"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.12 10.81 19.79 19.79 0 01.05 2.18 2 2 0 012.05.12h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L5.91 8.17a16 16 0 006.92 6.92l1.41-1.41a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v.09z"/></svg>
              (256) 274-8530
            </a>
          </div>
        </section>

        {/* ══════════════════ FOOTER ══════════════════ */}
        <footer className="border-t border-white/[0.04] py-8 px-6">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#39FF14]" />
              <span className="text-xs font-bold tracking-[0.2em] uppercase text-white/30">
                River City Roofing Solutions
              </span>
            </div>
            <span className="text-[11px] text-white/20">
              Huntsville, AL &bull; Madison &bull; Athens &bull; Decatur
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
