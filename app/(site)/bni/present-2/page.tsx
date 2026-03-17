'use client';

import { useState, useEffect, useCallback } from 'react';

interface SlideData {
  title: string;
  render: (notesVisible: boolean) => React.ReactNode;
  speakerNote: string;
}

export default function BNIPresentationV2Page() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [notesVisible, setNotesVisible] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const totalSlides = 6;

  const goToSlide = useCallback(
    (index: number, dir: 'left' | 'right') => {
      if (index < 0 || index >= totalSlides || index === currentSlide || transitioning) return;
      setDirection(dir);
      setTransitioning(true);
      setTimeout(() => {
        setCurrentSlide(index);
        setTimeout(() => setTransitioning(false), 50);
      }, 200);
    },
    [currentSlide, transitioning]
  );

  const nextSlide = useCallback(() => {
    goToSlide(currentSlide + 1, 'right');
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentSlide - 1, 'left');
  }, [currentSlide, goToSlide]);

  useEffect(() => {
    document.title = 'BNI Presentation (v2) - River City Roofing Solutions';
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'n' || e.key === 'N') {
        setNotesVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  const GreenBullet = () => (
    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#39FF14] mr-3 mt-2 flex-shrink-0" />
  );

  const SectionUnderline = () => (
    <div className="w-20 h-1 bg-[#39FF14] mt-4 mb-6" />
  );

  const CTAButton = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block border-2 border-[#39FF14] text-[#39FF14] font-bold px-8 py-4 rounded-lg text-xl hover:bg-[#39FF14] hover:text-black transition-colors"
    >
      {children}
    </a>
  );

  const SpeakerNote = ({ note, visible }: { note: string; visible: boolean }) => {
    if (!visible) return null;
    return (
      <div className="absolute bottom-16 left-8 right-8 text-sm text-neutral-500 italic bg-neutral-900/90 p-4 rounded-lg border border-neutral-800">
        <span className="text-neutral-600 font-semibold not-italic mr-2">Speaker Note:</span>
        {note}
      </div>
    );
  };

  // Speaker notes extracted to avoid self-referencing slides[] inside render
  const SPEAKER_NOTES = [
    'Good morning everyone. I\'m Michael with River City Roofing Solutions. Today I want to show you the technology we use that sets us apart and protects homeowners.',
    'Let me show you our StormCheck tool. Any homeowner can enter their address and get a free storm damage risk assessment using real National Weather Service data. Let me pull up this building\'s address...',
    'After the initial check, we generate a comprehensive report. This is the kind of documentation that insurance companies need. Let me show you a full report for this address...',
    'Once a homeowner becomes a customer, they get access to their personal portal. They can track everything - job progress, messages with their rep, documents, weather, and payments. Let me show you what a real customer sees...',
    'And here\'s something homeowners love - the IKO Roof Visualizer. We can take a photo of their home and show them exactly what different shingle styles will look like before we install. Let me show you with this building...',
    'So when you refer someone to us, this is the experience they\'ll get. Full documentation, complete transparency, and a beautiful new roof they chose themselves. And don\'t forget - you earn $200 for every referral. Thank you!',
  ];

  const slides: SlideData[] = [
    // Slide 1 - Title
    {
      title: 'Title',
      speakerNote: SPEAKER_NOTES[0],
      render: (notes) => (
        <div className="flex flex-col items-center justify-center h-full text-center px-8 relative">
          <div className="mb-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#39FF14]/20 border-2 border-[#39FF14] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-10 h-10 text-[#39FF14]" fill="currentColor">
                <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
              </svg>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-2 drop-shadow-[0_0_30px_rgba(57,255,20,0.3)]">
              RIVER CITY
            </h1>
            <h1 className="text-4xl md:text-6xl font-bold text-[#39FF14] tracking-tight mb-6 drop-shadow-[0_0_30px_rgba(57,255,20,0.3)]">
              ROOFING SOLUTIONS
            </h1>
          </div>
          <h2 className="text-xl md:text-2xl text-neutral-300 mb-4">
            Technology That Protects Homeowners
          </h2>
          <p className="text-lg text-neutral-400 mb-12 max-w-2xl">
            How we use cutting-edge tools to deliver a better experience
          </p>
          <p className="absolute bottom-24 text-sm text-neutral-600">
            BNI Presentation &mdash; March 2026
          </p>
          <SpeakerNote
            note={SPEAKER_NOTES[0]}
            visible={notes}
          />
        </div>
      ),
    },
    // Slide 2 - StormCheck
    {
      title: 'StormCheck',
      speakerNote: SPEAKER_NOTES[1],
      render: (notes) => (
        <div className="flex flex-col justify-center h-full px-8 md:px-16 lg:px-24 relative">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-0">
            StormCheck: <span className="text-[#39FF14]">Free Storm Damage Risk Assessment</span>
          </h1>
          <SectionUnderline />
          <h2 className="text-xl md:text-2xl text-neutral-300 mb-10">
            Real NWS data. Real hail reports. Real answers.
          </h2>
          <ul className="space-y-5 mb-10 max-w-3xl">
            {[
              'Homeowner enters their address',
              'We pull official National Weather Service hail & storm data',
              'Instant risk score with damage probability',
              'Identifies properties that need professional inspection',
            ].map((item, i) => (
              <li key={i} className="flex items-start text-lg text-neutral-200">
                <GreenBullet />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col items-start gap-3">
            <CTAButton href="https://www.rivercityroofingsolutions.com/check-my-address">
              LIVE DEMO &rarr;
            </CTAButton>
            <p className="text-sm text-neutral-500 mt-2">
              Demo: Enter &quot;100 N Beaty St, Athens, AL 35611&quot;
            </p>
          </div>
          <SpeakerNote note={SPEAKER_NOTES[1]} visible={notes} />
        </div>
      ),
    },
    // Slide 3 - Full Roof Report
    {
      title: 'Full Roof Report',
      speakerNote: SPEAKER_NOTES[2],
      render: (notes) => (
        <div className="flex flex-col justify-center h-full px-8 md:px-16 lg:px-24 relative">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-0">
            The Complete <span className="text-[#39FF14]">Storm &amp; Hail Report</span>
          </h1>
          <SectionUnderline />
          <h2 className="text-xl md:text-2xl text-neutral-300 mb-10">
            Official documentation homeowners can trust
          </h2>
          <ul className="space-y-5 mb-10 max-w-3xl">
            {[
              'Verified NWS hail event data with dates, sizes, distances',
              'HailRecon historical database (2011-present)',
              'Risk scoring with property-specific analysis',
              'Official documentation for insurance claims',
              'Shareable reports homeowners can reference',
            ].map((item, i) => (
              <li key={i} className="flex items-start text-lg text-neutral-200">
                <GreenBullet />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div>
            <CTAButton href="/bni/report">VIEW SAMPLE REPORT &rarr;</CTAButton>
          </div>
          <SpeakerNote note={SPEAKER_NOTES[2]} visible={notes} />
        </div>
      ),
    },
    // Slide 4 - Customer Portal
    {
      title: 'Customer Portal',
      speakerNote: SPEAKER_NOTES[3],
      render: (notes) => {
        const features = [
          { icon: '\u{1F4CB}', title: 'Job Progress', desc: 'Real-time status tracking' },
          { icon: '\u{1F4AC}', title: 'Messages', desc: 'Direct communication with your rep' },
          { icon: '\u{1F4C4}', title: 'Documents', desc: 'All paperwork in one place' },
          { icon: '\u{1F324}\u{FE0F}', title: 'Weather', desc: 'Live forecast for your area' },
          { icon: '\u{1F9CA}', title: 'Hail Report', desc: 'Historical storm data for your property' },
          { icon: '\u{1F4B3}', title: 'Payments', desc: 'Transparent billing & insurance info' },
        ];
        return (
          <div className="flex flex-col justify-center h-full px-8 md:px-16 lg:px-24 relative">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-0">
              Your Personal <span className="text-[#39FF14]">Customer Portal</span>
            </h1>
            <SectionUnderline />
            <h2 className="text-xl md:text-2xl text-neutral-300 mb-10">
              Complete transparency from inspection to installation
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10 max-w-4xl">
              {features.map((f, i) => (
                <div
                  key={i}
                  className="bg-neutral-800/80 border border-neutral-700 rounded-xl p-6 hover:border-[#39FF14]/40 hover:shadow-[0_0_20px_rgba(57,255,20,0.15)] transition-all"
                >
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="text-white font-semibold text-lg mb-1">{f.title}</h3>
                  <p className="text-neutral-400 text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
            <div>
              <CTAButton href="/bni/portal">VIEW PORTAL DEMO &rarr;</CTAButton>
            </div>
            <SpeakerNote note={SPEAKER_NOTES[3]} visible={notes} />
          </div>
        );
      },
    },
    // Slide 5 - IKO Roof Visualizer
    {
      title: 'IKO Roof Visualizer',
      speakerNote: SPEAKER_NOTES[4],
      render: (notes) => {
        const sellingPoints = [
          'Upload your own home photo',
          'Try IKO Dynasty, Cambridge, and Nordic shingle lines',
          'See realistic color previews',
          'Choose your perfect look before committing',
        ];
        return (
          <div className="flex flex-col justify-center h-full px-8 md:px-16 lg:px-24 relative">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-0">
              See Your New Roof <span className="text-[#39FF14]">Before We Install It</span>
            </h1>
            <SectionUnderline />
            <h2 className="text-lg md:text-xl text-neutral-300 mb-6">
              Our IKO Roof Visualizer lets you upload a photo of your home and try different shingle styles and colors
            </h2>

            <div className="flex flex-col md:flex-row gap-6 mb-6">
              {/* Visual: house with color swatches */}
              <div className="flex-shrink-0 w-full md:w-72">
                <div className="bg-neutral-800/80 border border-neutral-700 rounded-xl p-5 hover:border-[#39FF14]/40 hover:shadow-[0_0_20px_rgba(57,255,20,0.08)] transition-all">
                  <div className="flex flex-col items-center">
                    {/* Roof shape */}
                    <div className="relative w-48 h-0 border-l-[96px] border-r-[96px] border-b-[52px] border-l-transparent border-r-transparent border-b-[#0066CC] mb-0">
                      <div className="absolute top-[16px] left-[-58px] text-[9px] font-bold text-white/80 uppercase tracking-wider whitespace-nowrap">Your shingle color</div>
                    </div>
                    {/* House body */}
                    <div className="w-48 h-24 bg-neutral-600 flex items-center justify-center relative">
                      <div className="w-9 h-14 bg-neutral-700 border-2 border-neutral-500 absolute bottom-0"></div>
                      <div className="w-7 h-7 bg-neutral-500/30 border-2 border-neutral-500 absolute left-5 top-3"></div>
                      <div className="w-7 h-7 bg-neutral-500/30 border-2 border-neutral-500 absolute right-5 top-3"></div>
                    </div>
                  </div>
                  {/* Color swatches */}
                  <div className="mt-3 flex justify-center gap-2">
                    {[
                      { color: '#2d2926', label: 'Charcoal' },
                      { color: '#5c4033', label: 'Brown' },
                      { color: '#1a1a2e', label: 'Black' },
                      { color: '#6b4c3b', label: 'Cedar' },
                      { color: '#4a5568', label: 'Slate' },
                    ].map((swatch) => (
                      <div key={swatch.label} className="flex flex-col items-center gap-1">
                        <div className="w-7 h-7 rounded-lg border-2 border-white/20 hover:border-[#39FF14] transition-colors cursor-pointer" style={{ backgroundColor: swatch.color }} />
                        <span className="text-[7px] text-neutral-500 uppercase">{swatch.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-[9px] text-[#39FF14] font-bold uppercase tracking-wider mt-2">Before &amp; After Preview</p>
                </div>
              </div>

              {/* Selling points */}
              <div className="flex-1">
                <ul className="space-y-3 mb-4">
                  {sellingPoints.map((item, i) => (
                    <li key={i} className="flex items-start text-lg text-neutral-200">
                      <GreenBullet />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {/* IKO ROOFPRO badge */}
                <div className="flex items-center gap-3 bg-neutral-800/60 border border-[#0066CC]/30 rounded-lg px-4 py-3">
                  <svg className="w-5 h-5 text-[#0066CC] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <span className="text-[#0066CC] font-bold uppercase tracking-wide text-xs">IKO ROOFPRO Craftsman Premier</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start gap-2">
              <CTAButton href="https://www.ikoroofing.com/roof-visualizer">
                TRY IT NOW &rarr;
              </CTAButton>
              <p className="text-xs text-neutral-500 mt-1">
                ikoroofing.com/roof-visualizer
              </p>
            </div>
            <SpeakerNote note={SPEAKER_NOTES[4]} visible={notes} />
          </div>
        );
      },
    },
    // Slide 6 - Close / Referral
    {
      title: 'Close / Referral',
      speakerNote: SPEAKER_NOTES[5],
      render: (notes) => {
        const keyPoints = [
          'Every property gets verified storm data & professional documentation',
          'Every customer gets their own portal with full transparency',
          'Every roof is backed by IKO warranty & our workmanship guarantee',
        ];
        return (
          <div className="flex flex-col justify-center h-full px-8 md:px-16 lg:px-24 relative">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-0">
              Technology + Craftsmanship ={' '}
              <span className="text-[#39FF14]">Peace of Mind</span>
            </h1>
            <SectionUnderline />
            <h2 className="text-xl md:text-2xl text-neutral-300 mb-10">
              This is why your referrals are in good hands
            </h2>
            <ul className="space-y-4 mb-10 max-w-3xl">
              {keyPoints.map((point, i) => (
                <li key={i} className="flex items-start text-lg text-neutral-200">
                  <svg
                    className="w-6 h-6 text-[#39FF14] mr-3 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <div className="bg-neutral-800/80 border-2 border-[#39FF14]/50 rounded-xl p-8 max-w-xl">
              <h3 className="text-3xl font-bold text-[#39FF14] mb-3">$200 Referral Reward</h3>
              <p className="text-neutral-300 mb-4">
                For every client you refer that completes a roofing project
              </p>
              <div className="space-y-2 text-neutral-400">
                <p>
                  <span className="text-neutral-500 mr-2">Call/Text:</span>
                  <a href="tel:2562748530" className="text-white hover:text-[#39FF14] transition-colors">
                    (256) 274-8530
                  </a>
                </p>
                <p>
                  <span className="text-neutral-500 mr-2">Email:</span>
                  <a
                    href="mailto:rcrs@rivercityroofingsolutions.com"
                    className="text-white hover:text-[#39FF14] transition-colors"
                  >
                    rcrs@rivercityroofingsolutions.com
                  </a>
                </p>
                <p>
                  <span className="text-neutral-500 mr-2">Web:</span>
                  <a
                    href="https://www.rivercityroofingsolutions.com/bni"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-[#39FF14] transition-colors"
                  >
                    rivercityroofingsolutions.com/bni
                  </a>
                </p>
              </div>
            </div>
            <SpeakerNote note={SPEAKER_NOTES[5]} visible={notes} />
          </div>
        );
      },
    },
  ];

  const progressPercent = ((currentSlide + 1) / totalSlides) * 100;

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-[#0a0a0f] via-[#111318] to-[#0a0a0f] overflow-hidden select-none">
      {/* Dot pattern overlay */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
        }}
      />

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-neutral-800 z-50">
        <div
          className="h-full bg-[#39FF14] transition-all duration-500 ease-out rounded-r-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* ESC hint */}
      <a
        href="/bni"
        className="absolute top-4 left-4 z-50 text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
      >
        ESC to exit
      </a>

      {/* Notes toggle hint */}
      <div className="absolute top-4 right-4 z-50 text-xs text-neutral-700">
        Press N for notes
      </div>

      {/* Slide content */}
      <div
        className={`w-full h-full relative z-10 transition-opacity duration-200 ease-in-out ${
          transitioning ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {slides[currentSlide].render(notesVisible)}
      </div>

      {/* Click navigation zones */}
      {currentSlide > 0 && (
        <button
          onClick={prevSlide}
          className="absolute left-0 top-0 w-24 h-full z-40 cursor-w-resize group"
          aria-label="Previous slide"
        >
          <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg
              className="w-8 h-8 text-neutral-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </button>
      )}
      {currentSlide < totalSlides - 1 && (
        <button
          onClick={nextSlide}
          className="absolute right-0 top-0 w-24 h-full z-40 cursor-e-resize group"
          aria-label="Next slide"
        >
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg
              className="w-8 h-8 text-neutral-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      )}

      {/* Slide counter - pill style */}
      <div className="absolute bottom-4 right-6 z-50 text-sm text-neutral-400 font-mono bg-neutral-800/80 px-3 py-1 rounded-full">
        {currentSlide + 1} / {totalSlides}
      </div>
    </div>
  );
}
