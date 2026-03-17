'use client';

import { useState, useEffect, useCallback } from 'react';

interface SlideData {
  title: string;
  render: (notesVisible: boolean) => React.ReactNode;
  speakerNote: string;
}

export default function BNIPresentationV3Page() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [notesVisible, setNotesVisible] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [currentTime, setCurrentTime] = useState('');

  const totalSlides = 6;

  const goToSlide = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalSlides || index === currentSlide) return;
      setCurrentSlide(index);
    },
    [currentSlide]
  );

  const nextSlide = useCallback(() => {
    goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

  useEffect(() => {
    document.title = 'BNI Presentation (v3) - River City Roofing Solutions';
  }, []);

  // Clock: update every minute
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      setCurrentTime(`${h12}:${m.toString().padStart(2, '0')} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
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

  const handleImgError = (key: string) => {
    setImgErrors((prev) => ({ ...prev, [key]: true }));
  };

  const Chevron = () => (
    <span className="text-[#39FF14] mr-3 mt-0.5 flex-shrink-0 font-mono text-sm">&gt;</span>
  );

  const CTAButton = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block bg-[#39FF14] text-black font-semibold px-6 py-3 rounded-full text-base hover:bg-[#32e614] transition-colors"
    >
      {children}
    </a>
  );

  const SpeakerNote = ({ note, visible }: { note: string; visible: boolean }) => {
    if (!visible) return null;
    return (
      <div className="absolute top-0 left-0 right-0 z-50 text-sm text-neutral-400 bg-[#161b22] px-8 py-3 border-b border-[#30363d]">
        <span className="text-[#0066CC] font-semibold mr-2">Note:</span>
        {note}
      </div>
    );
  };

  const slides: SlideData[] = [
    // Slide 1 - Title
    {
      title: 'Title',
      speakerNote:
        'Good morning everyone. I\'m Michael with River City Roofing Solutions. Today I want to show you the technology we use that sets us apart and protects homeowners.',
      render: (notes) => (
        <div className="flex flex-col items-center justify-center h-full text-center px-8 relative">
          <SpeakerNote note={slides[0].speakerNote} visible={notes} />
          <div className="mb-6">
            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-1">
              RIVER CITY ROOFING SOLUTIONS
            </h1>
            <div className="w-48 h-px bg-[#39FF14] mx-auto my-6" />
            <h2 className="text-base md:text-lg text-neutral-400 tracking-widest uppercase">
              Technology That Protects Homeowners
            </h2>
          </div>
          <p className="text-base text-neutral-500 mt-4 max-w-xl">
            How we use cutting-edge tools to deliver a better experience
          </p>
          <p className="absolute bottom-24 text-xs text-neutral-600 tracking-wide">
            BNI Presentation &mdash; March 2026
          </p>
        </div>
      ),
    },
    // Slide 2 - StormCheck
    {
      title: 'StormCheck',
      speakerNote:
        'Let me show you our StormCheck tool. Any homeowner can enter their address and get a free storm damage risk assessment using real National Weather Service data. Let me pull up this building\'s address...',
      render: (notes) => (
        <div className="flex flex-col justify-center h-full px-8 md:px-16 lg:px-24 relative">
          <SpeakerNote note={slides[1].speakerNote} visible={notes} />
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">
            StormCheck
          </h1>
          <h2 className="text-base md:text-lg text-[#0066CC] mb-8 tracking-wide">
            Free Storm Damage Risk Assessment
          </h2>
          <p className="text-base text-neutral-400 mb-8 max-w-2xl">
            Real NWS data. Real hail reports. Real answers.
          </p>
          <ul className="space-y-4 mb-10 max-w-3xl">
            {[
              'Homeowner enters their address',
              'We pull official National Weather Service hail & storm data',
              'Instant risk score with damage probability',
              'Identifies properties that need professional inspection',
            ].map((item, i) => (
              <li key={i} className="flex items-start text-base text-neutral-300">
                <Chevron />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col items-start gap-3">
            <CTAButton href="https://www.rivercityroofingsolutions.com/check-my-address">
              LIVE DEMO &rarr;
            </CTAButton>
            <p className="text-xs text-neutral-600 mt-2">
              Demo: Enter &quot;100 N Beaty St, Athens, AL 35611&quot;
            </p>
          </div>
        </div>
      ),
    },
    // Slide 3 - Full Roof Report
    {
      title: 'Full Roof Report',
      speakerNote:
        'After the initial check, we generate a comprehensive report. This is the kind of documentation that insurance companies need. Let me show you a full report for this address...',
      render: (notes) => (
        <div className="flex flex-col justify-center h-full px-8 md:px-16 lg:px-24 relative">
          <SpeakerNote note={slides[2].speakerNote} visible={notes} />
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">
            The Complete Storm &amp; Hail Report
          </h1>
          <h2 className="text-base md:text-lg text-[#39FF14] mb-8 tracking-wide">
            Official documentation homeowners can trust
          </h2>
          <ul className="space-y-4 mb-10 max-w-3xl">
            {[
              'Verified NWS hail event data with dates, sizes, distances',
              'HailRecon historical database (2011-present)',
              'Risk scoring with property-specific analysis',
              'Official documentation for insurance claims',
              'Shareable reports homeowners can reference',
            ].map((item, i) => (
              <li key={i} className="flex items-start text-base text-neutral-300">
                <Chevron />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div>
            <CTAButton href="/bni/report">VIEW SAMPLE REPORT &rarr;</CTAButton>
          </div>
        </div>
      ),
    },
    // Slide 4 - Customer Portal
    {
      title: 'Customer Portal',
      speakerNote:
        'Once a homeowner becomes a customer, they get access to their personal portal. They can track everything - job progress, messages with their rep, documents, weather, and payments. Let me show you what a real customer sees...',
      render: (notes) => {
        const features = [
          { title: 'Job Progress', desc: 'Real-time status tracking' },
          { title: 'Messages', desc: 'Direct communication with your rep' },
          { title: 'Documents', desc: 'All paperwork in one place' },
          { title: 'Weather', desc: 'Live forecast for your area' },
          { title: 'Hail Report', desc: 'Historical storm data for your property' },
          { title: 'Payments', desc: 'Transparent billing & insurance info' },
        ];
        return (
          <div className="flex flex-col justify-center h-full px-8 md:px-16 lg:px-24 relative">
            <SpeakerNote note={slides[3].speakerNote} visible={notes} />
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">
              Your Personal Customer Portal
            </h1>
            <h2 className="text-base md:text-lg text-[#0066CC] mb-10 tracking-wide">
              Complete transparency from inspection to installation
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10 max-w-4xl">
              {features.map((f, i) => (
                <div
                  key={i}
                  className="bg-[#161b22] border-none rounded-lg p-8 border-t-2 border-[#39FF14]"
                  style={{ borderTop: '2px solid #39FF14' }}
                >
                  <h3 className="text-white font-semibold text-base mb-1">{f.title}</h3>
                  <p className="text-neutral-500 text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
            <div>
              <CTAButton href="/bni/portal">VIEW PORTAL DEMO &rarr;</CTAButton>
            </div>
          </div>
        );
      },
    },
    // Slide 5 - IKO Roof Visualizer
    {
      title: 'IKO Roof Visualizer',
      speakerNote:
        'And here\'s something homeowners love - the IKO Roof Visualizer. We can take a photo of their home and show them exactly what different shingle styles will look like before we install. Let me show you with this building...',
      render: (notes) => {
        const streetViewImages = [
          {
            key: 'front',
            label: 'Front View',
            url: 'https://maps.googleapis.com/maps/api/streetview?size=600x400&location=34.8025,-86.9717&heading=0&pitch=20&key=AIzaSyB8lFAdlWJ4MP4vJi0nMxcl2whstCPsv4g',
          },
          {
            key: 'side',
            label: 'Side View',
            url: 'https://maps.googleapis.com/maps/api/streetview?size=600x400&location=34.8025,-86.9717&heading=90&pitch=20&key=AIzaSyB8lFAdlWJ4MP4vJi0nMxcl2whstCPsv4g',
          },
          {
            key: 'rear',
            label: 'Rear View',
            url: 'https://maps.googleapis.com/maps/api/streetview?size=600x400&location=34.8025,-86.9717&heading=180&pitch=20&key=AIzaSyB8lFAdlWJ4MP4vJi0nMxcl2whstCPsv4g',
          },
        ];
        return (
          <div className="flex flex-col justify-center h-full px-8 md:px-16 lg:px-24 relative">
            <SpeakerNote note={slides[4].speakerNote} visible={notes} />
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">
              See Your New Roof Before We Install
            </h1>
            <h2 className="text-base md:text-lg text-[#39FF14] mb-6 tracking-wide">
              IKO Roof Visualizer: Choose your perfect look
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 max-w-5xl">
              {streetViewImages.map((img) => (
                <div key={img.key} className="relative">
                  {imgErrors[img.key] ? (
                    <div className="w-full aspect-[3/2] bg-[#161b22] rounded-lg flex items-center justify-center">
                      <div className="text-center text-neutral-600">
                        <svg
                          className="w-10 h-10 mx-auto mb-2 text-neutral-700"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <p className="text-xs">Unavailable</p>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={img.url}
                      alt={`${img.label} of Athens-Limestone Visitors Center`}
                      loading="lazy"
                      className="w-full aspect-[3/2] object-cover rounded-lg"
                      onError={() => handleImgError(img.key)}
                    />
                  )}
                  <p className="text-center text-xs text-neutral-500 mt-2">
                    {img.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-neutral-500 mb-6 text-sm">
              Upload any of these photos to see different shingle styles instantly
            </p>
            <div className="flex flex-col items-start gap-2">
              <CTAButton href="https://www.ikoroofing.com/en-us/roofing-tools/roof-visualizer/">
                OPEN IKO VISUALIZER &rarr;
              </CTAButton>
              <p className="text-xs text-neutral-700 mt-1">
                Right-click images above to save for upload
              </p>
            </div>
          </div>
        );
      },
    },
    // Slide 6 - Close / Referral
    {
      title: 'Close / Referral',
      speakerNote:
        'So when you refer someone to us, this is the experience they\'ll get. Full documentation, complete transparency, and a beautiful new roof they chose themselves. And don\'t forget - you earn $200 for every referral. Thank you!',
      render: (notes) => {
        const keyPoints = [
          'Every property gets verified storm data & professional documentation',
          'Every customer gets their own portal with full transparency',
          'Every roof is backed by IKO warranty & our workmanship guarantee',
        ];
        return (
          <div className="flex flex-col justify-center h-full px-8 md:px-16 lg:px-24 relative">
            <SpeakerNote note={slides[5].speakerNote} visible={notes} />
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">
              Technology + Craftsmanship
            </h1>
            <h2 className="text-base md:text-lg text-[#0066CC] mb-8 tracking-wide">
              This is why your referrals are in good hands
            </h2>
            <ul className="space-y-4 mb-10 max-w-3xl">
              {keyPoints.map((point, i) => (
                <li key={i} className="flex items-start text-base text-neutral-300">
                  <svg
                    className="w-5 h-5 text-[#39FF14] mr-3 mt-0.5 flex-shrink-0"
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
            <div className="bg-[#161b22] rounded-lg p-8 max-w-xl" style={{ borderTop: '2px solid #39FF14' }}>
              <h3 className="text-2xl font-bold text-[#39FF14] mb-2">$200 Referral Reward</h3>
              <p className="text-neutral-400 text-sm mb-4">
                For every client you refer that completes a roofing project
              </p>
              <div className="space-y-2 text-neutral-500 text-sm">
                <p>
                  <span className="text-neutral-600 mr-2">Call/Text:</span>
                  <a href="tel:2562748530" className="text-white hover:text-[#39FF14] transition-colors">
                    (256) 274-8530
                  </a>
                </p>
                <p>
                  <span className="text-neutral-600 mr-2">Email:</span>
                  <a
                    href="mailto:rcrs@rivercityroofingsolutions.com"
                    className="text-white hover:text-[#39FF14] transition-colors"
                  >
                    rcrs@rivercityroofingsolutions.com
                  </a>
                </p>
                <p>
                  <span className="text-neutral-600 mr-2">Web:</span>
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
          </div>
        );
      },
    },
  ];

  const progressPercent = ((currentSlide + 1) / totalSlides) * 100;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0d1117] overflow-hidden select-none">
      {/* Back link */}
      <a
        href="/bni"
        className="absolute top-4 left-4 z-50 text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
      >
        &larr; Back
      </a>

      {/* Current time */}
      <div className="absolute top-4 right-4 z-50 text-xs text-neutral-600 font-mono">
        {currentTime}
      </div>

      {/* Notes toggle hint */}
      <div className="absolute top-4 right-28 z-50 text-xs text-neutral-700">
        Press N for notes
      </div>

      {/* Slide content */}
      <div className="w-full h-full">
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
              className="w-6 h-6 text-neutral-700"
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
              className="w-6 h-6 text-neutral-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      )}

      {/* Bottom bar: slide counter (left), breadcrumb dots (center), progress bar (full width) */}
      <div className="absolute bottom-0 left-0 right-0 z-50">
        {/* Progress bar - thin line at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#161b22]">
          <div
            className="h-full bg-[#0066CC] transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Slide counter - bottom left */}
        <div className="absolute bottom-3 left-6 text-xs text-neutral-600 font-mono">
          {currentSlide + 1} / {totalSlides}
        </div>

        {/* Breadcrumb dots - bottom center */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                i === currentSlide
                  ? 'bg-[#39FF14] w-3'
                  : 'bg-neutral-700 hover:bg-neutral-500'
              }`}
              aria-label={`Go to slide ${i + 1}: ${slides[i].title}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
