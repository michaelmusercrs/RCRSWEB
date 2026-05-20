'use client';

import { useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AddressAutocomplete, { AddressResult } from '@/components/AddressAutocomplete';
import HoneypotField from '@/components/forms/HoneypotField';
import TurnstileWidget from '@/components/forms/TurnstileWidget';
import {
  CloudLightning,
  Shield,
  Phone,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  Home,
  Target,
  ArrowRight,
  AlertTriangle,
  MapPin,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StormReportData {
  reportId: string;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Severe';
  riskScore: number;
  totalHailReports: number;
  closestHailMiles: number | null;
  largestHailSize: string | null;
  riskFactors: string[];
  recommendation: string;
  fullAddress: string;
}

// ---------------------------------------------------------------------------
// Risk level styling
// ---------------------------------------------------------------------------

function getRiskColors(level: string) {
  switch (level) {
    case 'Severe':
      return { gradient: 'from-red-600 to-orange-600', text: 'text-red-400', bg: 'bg-red-600' };
    case 'High':
      return { gradient: 'from-orange-500 to-amber-500', text: 'text-orange-400', bg: 'bg-orange-500' };
    case 'Moderate':
      return { gradient: 'from-yellow-500 to-lime-500', text: 'text-yellow-400', bg: 'bg-yellow-500' };
    default:
      return { gradient: 'from-green-500 to-emerald-500', text: 'text-green-400', bg: 'bg-green-500' };
  }
}

// ---------------------------------------------------------------------------
// Results / Teaser Page
// ---------------------------------------------------------------------------

function ResultsPage({
  report,
  customerName,
  customerEmail,
  onReset,
}: {
  report: StormReportData;
  customerName: string;
  customerEmail: string;
  onReset: () => void;
}) {
  const hasEmail = !!customerEmail;
  const riskColors = getRiskColors(report.riskLevel);

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Risk Level Banner */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden">
        <div className={`bg-gradient-to-r ${riskColors.gradient} p-8 text-center`}>
          <p className="text-white/80 text-sm font-semibold uppercase tracking-wider mb-1">
            Storm Damage Risk Level
          </p>
          <h2 className="text-5xl sm:text-6xl font-black text-white uppercase tracking-wider">
            {report.riskLevel}
          </h2>
          <p className="text-white/70 text-sm mt-2">Risk Score: {report.riskScore}/100</p>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-3 divide-x divide-neutral-800 border-b border-neutral-800">
          <div className="p-5 text-center">
            <p className="text-2xl font-black text-white">{report.totalHailReports}</p>
            <p className="text-neutral-400 text-xs uppercase tracking-wider mt-1">Hail Reports</p>
          </div>
          <div className="p-5 text-center">
            <p className={`text-2xl font-black ${hasEmail ? 'text-white' : 'text-neutral-600 blur-sm select-none'}`}>
              {report.closestHailMiles !== null ? `${report.closestHailMiles} mi` : 'N/A'}
            </p>
            <p className="text-neutral-400 text-xs uppercase tracking-wider mt-1">Closest Hail</p>
          </div>
          <div className="p-5 text-center">
            <p className={`text-2xl font-black ${hasEmail ? 'text-white' : 'text-neutral-600 blur-sm select-none'}`}>
              {report.largestHailSize || 'N/A'}
            </p>
            <p className="text-neutral-400 text-xs uppercase tracking-wider mt-1">Largest Size</p>
          </div>
        </div>

        {/* Address */}
        <div className="px-6 py-4 flex items-center gap-2 text-neutral-400 text-sm border-b border-neutral-800">
          <MapPin className="w-4 h-4 text-brand-green flex-shrink-0" />
          <span>{report.fullAddress}</span>
        </div>

        {/* Email confirmation or upsell */}
        {hasEmail ? (
          <div className="p-6 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-brand-green flex-shrink-0" />
            <p className="text-brand-green font-semibold text-sm">
              Full report sent to {customerEmail}
            </p>
          </div>
        ) : (
          <div className="p-6 bg-yellow-500/5 border-t border-yellow-500/20">
            <p className="text-yellow-300 font-semibold text-sm mb-1">
              Want the full detailed report?
            </p>
            <p className="text-neutral-400 text-xs">
              Contact us at{' '}
              <a href="tel:256-274-8530" className="text-brand-green underline">(256) 274-8530</a>{' '}
              or go back and enter your email to get the complete storm report with all details.
            </p>
          </div>
        )}

        {/* Recommendation */}
        <div className="p-6 border-t border-neutral-800">
          <p className="text-neutral-300 text-sm leading-relaxed">{report.recommendation}</p>
        </div>
      </div>

      {/* What Happens Next */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
        <h3 className="text-xl font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-brand-green" />
          What Happens Next
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 bg-brand-green text-black text-sm font-black rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            <p className="text-neutral-300 text-sm">A River City Roofing representative will reach out to schedule your <strong className="text-white">free roof inspection</strong>.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 bg-brand-green text-black text-sm font-black rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            <p className="text-neutral-300 text-sm">Our certified inspector will check your roof for storm damage — takes about <strong className="text-white">30 minutes, no cost</strong>.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 bg-brand-green text-black text-sm font-black rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            <p className="text-neutral-300 text-sm">If damage is found, we&apos;ll help you through the <strong className="text-white">insurance claim process</strong> at no upfront cost to you.</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-brand-green/10 border-2 border-brand-green/40 rounded-2xl p-8 text-center">
        <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-3">
          Don&apos;t Wait — Call Now
        </h3>
        <p className="text-neutral-300 mb-6 max-w-lg mx-auto">
          Storm damage gets worse over time. The sooner you get an inspection, the better your chances of a successful insurance claim.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="tel:256-274-8530"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-brand-green text-black font-black uppercase tracking-widest rounded-lg hover:bg-lime-400 transition-all shadow-xl"
          >
            <Phone className="w-5 h-5" />
            Call (256) 274-8530
          </a>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-brand-green text-brand-green font-black uppercase tracking-widest rounded-lg hover:bg-brand-green hover:text-black transition-all"
          >
            Request Online
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Check another */}
      <div className="text-center">
        <button
          onClick={onReset}
          className="text-neutral-400 hover:text-brand-green transition-colors text-sm font-semibold uppercase tracking-wider"
        >
          Check Another Address
        </button>
      </div>

      {/* Disclaimer */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 mt-4">
        <p className="text-neutral-500 text-xs leading-relaxed">
          <strong className="text-neutral-400">Disclaimer:</strong> The storm report provided is for informational purposes only and is based on publicly available National Weather Service data. River City Roofing Solutions makes no guarantees, representations, or warranties regarding the accuracy or completeness of this report. This report does not constitute a professional roof inspection. We do not guarantee that any insurance company will or will not cover roof damage, repairs, or replacement. Insurance coverage decisions are made solely by your insurance provider based on your specific policy and their own inspection. A professional on-site inspection is required to determine the actual condition of your roof. Contact your insurance provider for questions about your coverage.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CheckMyAddressPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <CheckMyAddressPage />
    </Suspense>
  );
}

function CheckMyAddressPage() {
  const searchParams = useSearchParams();
  const repSlug = searchParams.get('rep') || ''; // e.g. ?rep=hunter

  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<StormReportData | null>(null);
  const [error, setError] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [formLoadedAt] = useState(() => Date.now()); // bot timing trap
  const [honeypot, setHoneypot] = useState(''); // bot honeypot field
  const [turnstileToken, setTurnstileToken] = useState('');

  // Form state
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('AL');
  const [zip, setZip] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notAlabama, setNotAlabama] = useState(false);

  const handleAddressSelect = useCallback((result: AddressResult) => {
    const streetParts: string[] = [];
    if (result.streetNumber) streetParts.push(result.streetNumber);
    if (result.street) streetParts.push(result.street);
    const streetAddress = streetParts.length > 0 ? streetParts.join(' ') : result.formattedAddress.split(',')[0];

    setAddress(streetAddress);
    setCity(result.city || '');
    setState(result.state || 'AL');
    setZip(result.zip || '');

    // Check if outside Alabama
    const selectedState = (result.state || '').toUpperCase();
    if (selectedState && selectedState !== 'AL') {
      setNotAlabama(true);
    } else {
      setNotAlabama(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (state.toUpperCase() !== 'AL') {
      setNotAlabama(true);
      return;
    }

    // Bot protection: honeypot field filled = bot
    if (honeypot) {
      // Silently pretend success — don't tell bots they failed
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 2000);
      return;
    }

    // Bot protection: submitted too fast (< 3 seconds) = likely bot
    if (Date.now() - formLoadedAt < 3000) {
      setError('Please take a moment to fill out the form completely.');
      return;
    }

    setIsLoading(true);
    setError('');
    setReport(null);
    setCustomerName(name);

    try {
      // 1. Generate storm report
      const reportRes = await fetch('/api/storm-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          city,
          state,
          zip,
          website: honeypot,
          turnstileToken,
        }),
      });

      const reportResult = await reportRes.json();

      if (!reportResult.success) {
        throw new Error(reportResult.error || 'Failed to generate storm report');
      }

      setReport(reportResult.data);

      // 2. Send emails in background (only if email provided).
      // Pass turnstileToken: 'disabled' — the first /api/storm-report call
      // already verified the user; Cloudflare tokens are single-use so we
      // can't re-verify the original here.
      if (email) fetch('/api/storm-report/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerEmail: email || undefined,
          customerPhone: phone,
          assignedRep: repSlug || undefined,
          reportId: reportResult.data.reportId,
          address,
          fullAddress: reportResult.data.fullAddress,
          riskLevel: reportResult.data.riskLevel,
          riskScore: reportResult.data.riskScore,
          totalHailReports: reportResult.data.totalHailReports,
          largestHailSize: reportResult.data.largestHailSize,
          largestHailSizeNum: reportResult.data.largestHailSizeNum,
          closestHailMiles: reportResult.data.closestHailMiles,
          riskFactors: reportResult.data.riskFactors,
          recommendation: reportResult.data.recommendation,
          hailEvents: reportResult.data.hailEvents,
          windEvents: reportResult.data.windEvents,
          dateRangeStart: reportResult.data.dateRangeStart,
          dateRangeEnd: reportResult.data.dateRangeEnd,
          website: honeypot,
          turnstileToken: 'disabled',
        }),
      }).catch((err) => console.error('Email error:', err));

      // 3. Create lead (always — even without email) in background.
      // Same single-use-token rationale as above: pass 'disabled'.
      fetch('/api/leads/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: email || undefined,
          phone,
          address: `${address}, ${city}, ${state} ${zip}`,
          city,
          state,
          zip,
          source: 'contact_form',
          sourceDetails: repSlug ? `Check My Address - Storm Report (Rep: ${repSlug})` : 'Check My Address - Storm Report',
          assignedRep: repSlug || undefined,
          sourcePage: 'Check My Address',
          serviceType: 'Storm/Hail Inspection',
          message: `Storm Report: Risk Level ${reportResult.data.riskLevel} (${reportResult.data.riskScore}/100). ${reportResult.data.totalHailReports} hail reports found. Report ID: ${reportResult.data.reportId}`,
          sendNotifications: true,
          notifyTeam: true,
          website: honeypot,
          turnstileToken: 'disabled',
        }),
      }).catch((err) => console.error('Lead creation error:', err));

    } catch (err) {
      console.error('Storm report error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setReport(null);
    setError('');
    setAddress('');
    setCity('');
    setState('AL');
    setZip('');
    setName('');
    setPhone('');
    setEmail('');
    setNotAlabama(false);
  };

  return (
    <div className="min-h-screen text-white">
      {/* Hero */}
      <div className="-mt-20 pt-32 pb-12 sm:pt-36 sm:pb-16 px-6 bg-black/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-green/15 border border-brand-green/30 px-4 py-2 rounded-full mb-6">
            <CloudLightning className="w-4 h-4 text-brand-green" />
            <span className="text-brand-green text-sm font-semibold uppercase tracking-wider">Free Storm Report</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-wider mb-4 leading-tight">
            Has Your Home Been Hit by{' '}
            <span className="text-brand-green">Storm Damage?</span>
          </h1>

          <p className="text-lg sm:text-xl text-neutral-300 max-w-2xl mx-auto leading-relaxed mb-8">
            Enter your address and get an instant storm damage risk report — 100% free, no obligation.
            Real data from the National Weather Service.
          </p>

          <div className="flex flex-wrap justify-center gap-4 sm:gap-8 text-sm text-neutral-400">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-green" />
              100% Free
            </span>
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-green" />
              No Obligation
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-green" />
              Instant Results
            </span>
            <span className="flex items-center gap-2">
              <Target className="w-4 h-4 text-brand-green" />
              Real NWS Data
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <section className="py-12 px-6 bg-black/85 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-2xl mx-auto">

          {/* Error State */}
          {error && !report && (
            <div className="mb-6 p-6 bg-neutral-950 border border-red-500/30 rounded-2xl text-center">
              <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white mb-2">Something Went Wrong</h3>
              <p className="text-neutral-400 text-sm mb-4">
                No worries — give us a call and we&apos;ll pull your storm data manually.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="tel:256-274-8530"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-green text-black font-bold rounded-lg hover:bg-lime-400 transition-all"
                >
                  <Phone className="w-4 h-4" />
                  Call (256) 274-8530
                </a>
                <button
                  onClick={() => setError('')}
                  className="px-6 py-3 border border-neutral-700 text-neutral-300 font-bold rounded-lg hover:border-brand-green hover:text-brand-green transition-all"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Results */}
          {report ? (
            <ResultsPage report={report} customerName={customerName} customerEmail={email} onReset={handleReset} />
          ) : (
            /* Form */
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-6 flex items-center gap-3">
                <Search className="w-6 h-6 text-brand-green" />
                Enter Your Address
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Address Autocomplete */}
                <div>
                  <label className="block text-sm font-semibold text-neutral-300 mb-1.5">
                    Street Address *
                  </label>
                  <AddressAutocomplete
                    onAddressSelect={handleAddressSelect}
                    placeholder="Start typing your address..."
                    required
                    className="!bg-neutral-900 !border-neutral-700 focus:!border-brand-green focus:!ring-brand-green"
                  />
                  {city && state && (
                    <p className="mt-1.5 text-xs text-brand-green/70 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {city}, {state} {zip}
                    </p>
                  )}
                </div>

                {/* Not Alabama Warning */}
                {notAlabama && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-yellow-300 font-semibold text-sm">
                          We currently only serve Alabama
                        </p>
                        <p className="text-yellow-300/70 text-xs mt-1">
                          River City Roofing Solutions is based in North Alabama. We&apos;re expanding soon — call us at{' '}
                          <a href="tel:256-274-8530" className="underline">(256) 274-8530</a> to see if we can help.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* City / State / Zip — auto-filled, hidden but editable */}
                <div className="grid grid-cols-5 gap-3">
                  <div className="col-span-2">
                    <label htmlFor="city" className="block text-sm font-semibold text-neutral-300 mb-1.5">City</label>
                    <input
                      type="text"
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Decatur"
                      className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                    />
                  </div>
                  <div className="col-span-2">
                    <label htmlFor="state" className="block text-sm font-semibold text-neutral-300 mb-1.5">State</label>
                    <input
                      type="text"
                      id="state"
                      value={state}
                      readOnly
                      className="w-full px-4 py-3 bg-neutral-900/50 border border-neutral-700 rounded-lg text-neutral-400 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label htmlFor="zip" className="block text-sm font-semibold text-neutral-300 mb-1.5">Zip</label>
                    <input
                      type="text"
                      id="zip"
                      maxLength={5}
                      value={zip}
                      onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
                      placeholder="35601"
                      className="w-full px-3 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-neutral-800 pt-4">
                  <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold mb-3">
                    Your Info (so we can send your report)
                  </p>
                </div>

                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-neutral-300 mb-1.5">Name *</label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Smith"
                    className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                  />
                </div>

                {/* Phone + Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-semibold text-neutral-300 mb-1.5">Phone *</label>
                    <input
                      type="tel"
                      id="phone"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(256) 555-1234"
                      className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-neutral-300 mb-1.5">
                      Email <span className="text-neutral-500">(required for full report)</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Without an email, you&apos;ll see a preview only. Add your email to get the full report sent to you.
                    </p>
                  </div>
                </div>

                {/* Honeypot — hidden from humans, bots will fill it.
                    Client-side check above short-circuits before fetch;
                    server-side checkHoneypot() in the API routes is the
                    real defense. */}
                <HoneypotField value={honeypot} onChange={setHoneypot} />

                <TurnstileWidget onVerify={setTurnstileToken} theme="dark" />

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading || notAlabama}
                  className="w-full py-4 bg-brand-green text-black font-black uppercase tracking-widest text-lg rounded-lg hover:bg-lime-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl shadow-brand-green/20"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Analyzing Your Address...
                    </>
                  ) : (
                    <>
                      <Search className="w-6 h-6" />
                      Get My Free Storm Report
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-neutral-500 leading-relaxed">
                  100% free. No obligation. Your information is never shared with third parties.
                </p>
                <p className="text-center text-[10px] text-neutral-600 leading-relaxed mt-2">
                  This report is for informational purposes only and does not guarantee insurance coverage or claim approval. A professional inspection is required to assess actual roof condition.
                </p>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* How It Works — only show before results */}
      {!report && (
        <section className="py-12 px-6 bg-black/80 backdrop-blur-sm border-t border-neutral-800">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">How It Works</span>
              <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-wider mt-2">3 Simple Steps</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Home, step: '1', title: 'Enter Your Address', desc: 'Tell us where your property is and we\'ll look it up.' },
                { icon: Search, step: '2', title: 'We Check the Data', desc: 'We pull real hail and storm data from the National Weather Service.' },
                { icon: Shield, step: '3', title: 'Get Your Report', desc: 'See your risk level and whether you should get a free inspection.' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="text-center">
                    <div className="relative inline-block mb-4">
                      <div className="w-16 h-16 bg-brand-green/15 rounded-2xl flex items-center justify-center mx-auto">
                        <Icon className="w-8 h-8 text-brand-green" />
                      </div>
                      <span className="absolute -top-2 -right-2 w-7 h-7 bg-brand-green text-black text-sm font-black rounded-full flex items-center justify-center">
                        {item.step}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">{item.title}</h3>
                    <p className="text-neutral-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <section className="py-12 px-6 bg-brand-green/95 backdrop-blur-sm text-black border-t border-neutral-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-wider mb-4">
            Protect Your Biggest Investment
          </h2>
          <p className="text-lg mb-8 text-black/75 leading-relaxed">
            Your roof protects everything underneath it. Don&apos;t wait for a leak to find out about storm damage.
          </p>
          <a
            href="tel:256-274-8530"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-black text-black font-black uppercase tracking-widest rounded-lg hover:bg-black hover:text-brand-green transition-all"
          >
            <Phone className="w-5 h-5" />
            Call (256) 274-8530
          </a>
        </div>
      </section>
    </div>
  );
}
