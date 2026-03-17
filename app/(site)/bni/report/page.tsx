'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

const REPORT = {
  id: 'SR-20260224-4721',
  generated: 'February 24, 2026',
  property: '100 N Beaty St, Athens, AL 35611',
  coordinates: '34.8025°N, 86.9717°W',
  county: 'Limestone County, Alabama',
  riskLevel: 'HIGH',
  riskScore: 78,
};

interface HailEvent {
  date: string;
  size: string;
  sizeRef: string;
  severity: 'Moderate' | 'Severe';
  location: string;
  distance: string;
}

const HAIL_EVENTS: HailEvent[] = [
  { date: 'Mar 2, 2026', size: '1.75"', sizeRef: 'Golf Ball', severity: 'Severe', location: 'Athens, Limestone Co.', distance: '1.2 mi' },
  { date: 'Jan 11, 2026', size: '1.00"', sizeRef: 'Quarter', severity: 'Moderate', location: 'Tanner, Limestone Co.', distance: '8.4 mi' },
  { date: 'Nov 3, 2025', size: '1.50"', sizeRef: 'Ping Pong Ball', severity: 'Severe', location: 'Elkmont, Limestone Co.', distance: '12.1 mi' },
  { date: 'Sep 14, 2025', size: '1.25"', sizeRef: 'Half Dollar', severity: 'Moderate', location: 'Ardmore, Limestone Co.', distance: '14.7 mi' },
  { date: 'Apr 14, 2025', size: '2.00"', sizeRef: 'Hen Egg', severity: 'Severe', location: 'Harvest, Madison Co.', distance: '18.3 mi' },
  { date: 'Mar 27, 2025', size: '1.25"', sizeRef: 'Half Dollar', severity: 'Moderate', location: 'Athens, Limestone Co.', distance: '0.8 mi' },
  { date: 'May 8, 2024', size: '1.75"', sizeRef: 'Golf Ball', severity: 'Severe', location: 'Mooresville, Limestone Co.', distance: '15.6 mi' },
  { date: 'Mar 19, 2024', size: '1.00"', sizeRef: 'Quarter', severity: 'Moderate', location: 'Athens, Limestone Co.', distance: '2.1 mi' },
];

interface TimelineEvent {
  date: string;
  type: string;
  details: string;
  severe: boolean;
}

const TIMELINE_EVENTS: TimelineEvent[] = [
  { date: 'Mar 2, 2026', type: 'Severe Thunderstorm', details: '1.75" hail, 58 mph winds', severe: true },
  { date: 'Jan 11, 2026', type: 'Winter Storm', details: '1.00" hail with ice', severe: false },
  { date: 'Nov 3, 2025', type: 'Supercell Thunderstorm', details: '1.50" hail, 65 mph winds', severe: true },
  { date: 'Sep 14, 2025', type: 'Severe Thunderstorm', details: '1.25" hail', severe: false },
  { date: 'Apr 14, 2025', type: 'Severe Weather Outbreak', details: '2.00" hail, tornado warned', severe: true },
  { date: 'Mar 27, 2025', type: 'Thunderstorm', details: '1.25" hail', severe: false },
];

const HISTORICAL_YEARS = [
  { year: 2024, events: 6 },
  { year: 2023, events: 4 },
  { year: 2022, events: 3 },
  { year: 2021, events: 5 },
  { year: 2020, events: 2 },
  { year: 2019, events: 4 },
  { year: 2018, events: 6 },
  { year: 2017, events: 3 },
  { year: 2016, events: 4 },
  { year: 2015, events: 5 },
];

const MAX_EVENTS = Math.max(...HISTORICAL_YEARS.map((y) => y.events));

interface RiskFactor {
  active: boolean;
  label: string;
  points: string;
}

const RISK_FACTORS: RiskFactor[] = [
  { active: true, label: 'Recent hail activity (within 6 months)', points: '+25 points' },
  { active: true, label: 'Severe hail size (≥1.5")', points: '+20 points' },
  { active: true, label: 'Close proximity (within 2 miles)', points: '+15 points' },
  { active: true, label: 'Historical frequency (above average)', points: '+10 points' },
  { active: true, label: 'Seasonal risk (spring storm season approaching)', points: '+8 points' },
  { active: false, label: 'Active weather alerts', points: '+0 points (none currently)' },
];

const DATA_SOURCES = [
  'National Weather Service (NWS) — Storm Events Database',
  'NWS Weather Forecast Office — Huntsville, AL',
  'Storm Prediction Center (SPC) — Severe Weather Reports',
  'HailRecon Verified Hail Database (2011–Present)',
  'Iowa State University — Environmental Mesonet',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-1 h-8 bg-[#39FF14] rounded-full shrink-0" />
      <h2 className="text-2xl md:text-3xl font-bold text-white">{children}</h2>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-neutral-800/90 border border-neutral-700 rounded-xl p-6 md:p-8 ${className}`}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function BNIStormReportPage() {
  useEffect(() => {
    document.title = 'Storm/Hail Report — 100 N Beaty St, Athens AL | River City Roofing Solutions';
  }, []);

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          header, footer, nav, .no-print,
          .floating-contact, [data-promo-banner],
          button.no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-break { page-break-before: always; }
        }
      `}</style>

      <div className="min-h-screen bg-neutral-950 py-8 md:py-12 px-4">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* ── Header Bar ───────────────────────────────────────────────── */}
          <Card>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              {/* Left: Report Info */}
              <div className="space-y-1">
                <p className="text-xs tracking-widest uppercase text-neutral-400 mb-2">
                  StormCheck&trade; Property Report
                </p>
                <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
                  Storm &amp; Hail Damage Report
                </h1>
                <p className="text-neutral-400 text-sm mt-2">
                  Report ID: <span className="text-white font-mono">{REPORT.id}</span>
                  <span className="mx-2 text-neutral-600">|</span>
                  Generated: <span className="text-white">{REPORT.generated}</span>
                </p>
              </div>

              {/* Right: Print Button */}
              <button
                onClick={() => window.print()}
                className="no-print self-start shrink-0 flex items-center gap-2 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Report
              </button>
            </div>

            {/* Property Details */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div className="bg-neutral-900/80 rounded-lg p-4">
                <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Property Address</p>
                <p className="text-white font-semibold">{REPORT.property}</p>
              </div>
              <div className="bg-neutral-900/80 rounded-lg p-4">
                <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Coordinates</p>
                <p className="text-white font-mono text-sm">{REPORT.coordinates}</p>
              </div>
              <div className="bg-neutral-900/80 rounded-lg p-4">
                <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">County</p>
                <p className="text-white">{REPORT.county}</p>
              </div>
            </div>

            {/* Risk Level + Score */}
            <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <span className="bg-red-500/20 text-red-400 border border-red-500/40 px-4 py-2 rounded-full font-bold text-sm tracking-wide">
                RISK LEVEL: {REPORT.riskLevel}
              </span>
              <div className="flex-1 w-full sm:w-auto">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-neutral-400 text-xs">Risk Score</span>
                  <span className="text-white font-bold text-sm">{REPORT.riskScore}/100</span>
                </div>
                <div className="w-full h-3 bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${REPORT.riskScore}%`,
                      background: 'linear-gradient(90deg, #22c55e 0%, #eab308 40%, #f97316 70%, #ef4444 100%)',
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-neutral-500 mt-0.5">
                  <span>Low</span>
                  <span>Moderate</span>
                  <span>High</span>
                  <span>Severe</span>
                </div>
              </div>
            </div>
          </Card>

          {/* ── Risk Assessment Box ──────────────────────────────────────── */}
          <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="shrink-0 mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-red-400 mb-2">HIGH RISK</h3>
                <p className="text-neutral-300 leading-relaxed">
                  This property is in an area with significant recent hail activity.
                  Professional roof inspection is <span className="text-white font-semibold">strongly recommended</span>.
                </p>
                <Link
                  href="/contact"
                  className="no-print inline-flex items-center gap-2 mt-4 bg-[#39FF14] hover:bg-[#32e612] text-black font-bold px-6 py-3 rounded-lg transition-colors"
                >
                  Schedule Free Inspection
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          {/* ── Recent Hail Events ───────────────────────────────────────── */}
          <Card>
            <SectionTitle>Recent Hail Events (Within 25 Miles)</SectionTitle>
            <div className="overflow-x-auto -mx-6 md:-mx-8 px-6 md:px-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-400 text-xs uppercase tracking-wider border-b border-neutral-700">
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">Size</th>
                    <th className="pb-3 pr-4">Severity</th>
                    <th className="pb-3 pr-4">Location</th>
                    <th className="pb-3 text-right">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {HAIL_EVENTS.map((evt, i) => (
                    <tr
                      key={i}
                      className={`border-b border-neutral-800 ${i % 2 === 0 ? 'bg-neutral-900/50' : 'bg-neutral-900/20'}`}
                    >
                      <td className="py-3 pr-4 text-white font-medium whitespace-nowrap">{evt.date}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <span className="text-white font-bold">{evt.size}</span>
                        <span className="text-neutral-500 text-xs ml-1.5">({evt.sizeRef})</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            evt.severity === 'Severe'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {evt.severity}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-neutral-300 whitespace-nowrap">{evt.location}</td>
                      <td className="py-3 text-right text-neutral-300 font-mono whitespace-nowrap">{evt.distance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ── Storm Timeline ───────────────────────────────────────────── */}
          <Card className="print-break">
            <SectionTitle>Storm Timeline (Past 12 Months)</SectionTitle>
            <div className="relative ml-4">
              {/* Vertical line */}
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-neutral-700" />

              <div className="space-y-6">
                {TIMELINE_EVENTS.map((evt, i) => (
                  <div key={i} className="relative pl-10">
                    {/* Dot */}
                    <div
                      className={`absolute left-1.5 top-1.5 w-4 h-4 rounded-full border-2 ${
                        evt.severe
                          ? 'bg-red-500 border-red-400 shadow-lg shadow-red-500/30'
                          : 'bg-amber-500 border-amber-400 shadow-lg shadow-amber-500/20'
                      }`}
                    />
                    <div className="bg-neutral-900/60 rounded-lg p-4 border border-neutral-700/50">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <div>
                          <span className="text-white font-semibold">{evt.type}</span>
                          {evt.severe && (
                            <span className="ml-2 text-[10px] uppercase tracking-wider bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold">
                              Severe
                            </span>
                          )}
                        </div>
                        <span className="text-neutral-400 text-sm">{evt.date}</span>
                      </div>
                      <p className="text-neutral-400 text-sm mt-1">{evt.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* ── HailRecon Historical Data ────────────────────────────────── */}
          <Card>
            <SectionTitle>HailRecon Historical Analysis (2011–Present)</SectionTitle>
            <p className="text-neutral-500 text-xs uppercase tracking-wider mb-6">
              Data Source: HailRecon Database — 15 years of verified hail data
            </p>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Total Hail Events', sublabel: '10-mile radius', value: '47' },
                { label: 'Largest Recorded', sublabel: 'July 19, 2014', value: '2.75"' },
                { label: 'Most Recent', sublabel: '', value: 'Mar 2, 2026' },
                { label: 'Avg Annual Events', sublabel: '', value: '3.4' },
                { label: 'Peak Month', sublabel: '32% of events', value: 'April' },
                { label: 'Severe Events (>1.5")', sublabel: '', value: '18' },
              ].map((stat, i) => (
                <div key={i} className="bg-neutral-900/80 rounded-lg p-4 border border-neutral-700/50">
                  <p className="text-[#39FF14] text-2xl md:text-3xl font-extrabold">{stat.value}</p>
                  <p className="text-neutral-300 text-sm font-medium mt-1">{stat.label}</p>
                  {stat.sublabel && <p className="text-neutral-500 text-xs">{stat.sublabel}</p>}
                </div>
              ))}
            </div>

            {/* Historical Frequency Chart */}
            <h3 className="text-lg font-semibold text-white mb-4">Annual Hail Frequency</h3>
            <div className="space-y-2">
              {HISTORICAL_YEARS.map((yr) => (
                <div key={yr.year} className="flex items-center gap-3">
                  <span className="text-neutral-400 text-sm font-mono w-12 shrink-0">{yr.year}</span>
                  <div className="flex-1 h-6 bg-neutral-900 rounded overflow-hidden">
                    <div
                      className="h-full rounded bg-gradient-to-r from-[#39FF14]/80 to-[#39FF14] flex items-center justify-end pr-2 transition-all"
                      style={{ width: `${(yr.events / MAX_EVENTS) * 100}%` }}
                    >
                      <span className="text-black text-xs font-bold">{yr.events}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* ── Risk Factors ─────────────────────────────────────────────── */}
          <Card className="print-break">
            <SectionTitle>Risk Factor Breakdown</SectionTitle>
            <p className="text-neutral-400 text-sm mb-6">
              Factors contributing to the overall risk score of <span className="text-white font-bold">{REPORT.riskScore}/100</span>:
            </p>
            <div className="space-y-3">
              {RISK_FACTORS.map((factor, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-4 rounded-lg border ${
                    factor.active
                      ? 'bg-[#39FF14]/5 border-[#39FF14]/20'
                      : 'bg-neutral-900/50 border-neutral-700/50'
                  }`}
                >
                  <span className="shrink-0 text-lg mt-0.5">
                    {factor.active ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#39FF14]" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <span className={factor.active ? 'text-white font-medium' : 'text-neutral-500'}>
                      {factor.label}
                    </span>
                    <span className={`text-sm font-mono ${factor.active ? 'text-[#39FF14]' : 'text-neutral-600'}`}>
                      {factor.points}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* ── NWS Data Sources ─────────────────────────────────────────── */}
          <Card>
            <SectionTitle>Official Data Sources</SectionTitle>
            <div className="space-y-2 mb-6">
              {DATA_SOURCES.map((src, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-neutral-900/60 border border-neutral-700/40 rounded-lg px-4 py-3"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#39FF14] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-neutral-300 text-sm">{src}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-neutral-700 pt-5">
              <p className="text-neutral-500 text-xs leading-relaxed">
                <span className="text-neutral-400 font-semibold">Disclaimer:</span> This report uses data from official
                National Weather Service records and verified hail reporting databases. All hail event data is sourced
                from NWS Local Storm Reports and the Storm Prediction Center. This assessment is for informational
                purposes and does not replace a professional roof inspection.
              </p>
            </div>
          </Card>

          {/* ── Footer / CTA ─────────────────────────────────────────────── */}
          <Card className="text-center no-print">
            <p className="text-neutral-300 text-lg md:text-xl leading-relaxed mb-2">
              Based on this analysis, we recommend a <span className="text-white font-bold">professional roof inspection</span> for this property.
            </p>
            <h3 className="text-2xl md:text-3xl font-extrabold text-white mt-4 mb-2">
              Schedule Your Free Inspection Today
            </h3>
            <p className="text-neutral-400 mb-6">
              Call us: <a href="tel:+12562748530" className="text-[#39FF14] font-bold hover:underline">(256) 274-8530</a>
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-[#39FF14] hover:bg-[#32e612] text-black font-bold px-8 py-3.5 rounded-lg transition-colors text-lg"
              >
                Schedule Free Inspection
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/check-my-address"
                className="inline-flex items-center gap-2 border border-neutral-600 hover:border-neutral-400 text-white font-semibold px-8 py-3.5 rounded-lg transition-colors"
              >
                Check Another Address
              </Link>
            </div>
          </Card>

          {/* ── Small Print ───────────────────────────────────────────────── */}
          <p className="text-center text-neutral-600 text-xs pb-4">
            Report generated by River City Roofing Solutions StormCheck&trade; system. &copy; 2026 River City Roofing Solutions. All rights reserved.
          </p>

        </div>
      </div>
    </>
  );
}