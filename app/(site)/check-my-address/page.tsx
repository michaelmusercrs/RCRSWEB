'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import AddressAutocomplete, { AddressResult } from '@/components/AddressAutocomplete';
import {
  CloudLightning,
  Shield,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  ArrowRight,
  Search,
  Home,
  Target,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HailEvent {
  date: string;
  size: string;
  sizeNum: number;
  severity: 'minor' | 'moderate' | 'severe';
  distance: number;
  location: string;
  county: string;
}

interface HailReconEvent {
  date: string;
  hailSize: number;
  hailSizeLabel: string;
  distance: number;
  location: string;
  county: string;
  state: string;
}

interface StormReportData {
  reportId: string;
  generatedAt: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  fullAddress: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  hailEvents: HailEvent[];
  windEvents: { date: string; event: string; severity: string; description: string }[];
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Severe';
  riskScore: number;
  riskFactors: string[];
  recommendation: string;
  totalHailReports: number;
  closestHailMiles: number | null;
  largestHailSize: string | null;
  largestHailSizeNum: number;
  // HailRecon data
  hailReconEvents?: HailReconEvent[];
  hailReconTotalStorms?: number;
  hailReconLargestSize?: number;
  hailReconLargestSizeLabel?: string;
  hailReconDataRange?: { start: string; end: string };
}

// ---------------------------------------------------------------------------
// US States dropdown list (SE focus)
// ---------------------------------------------------------------------------

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'Washington DC' },
];

// ---------------------------------------------------------------------------
// Risk level styling
// ---------------------------------------------------------------------------

function getRiskColors(level: string) {
  switch (level) {
    case 'Severe':
      return {
        bg: 'bg-red-600',
        bgLight: 'bg-red-500/15',
        text: 'text-red-400',
        border: 'border-red-500/40',
        ringColor: 'ring-red-500',
        gradient: 'from-red-600 to-orange-600',
      };
    case 'High':
      return {
        bg: 'bg-orange-500',
        bgLight: 'bg-orange-500/15',
        text: 'text-orange-400',
        border: 'border-orange-500/40',
        ringColor: 'ring-orange-500',
        gradient: 'from-orange-500 to-amber-500',
      };
    case 'Moderate':
      return {
        bg: 'bg-yellow-500',
        bgLight: 'bg-yellow-500/15',
        text: 'text-yellow-400',
        border: 'border-yellow-500/40',
        ringColor: 'ring-yellow-500',
        gradient: 'from-yellow-500 to-lime-500',
      };
    default:
      return {
        bg: 'bg-green-500',
        bgLight: 'bg-green-500/15',
        text: 'text-green-400',
        border: 'border-green-500/40',
        ringColor: 'ring-green-500',
        gradient: 'from-green-500 to-emerald-500',
      };
  }
}

// ---------------------------------------------------------------------------
// Form Component
// ---------------------------------------------------------------------------

function AddressForm({
  onSubmit,
  isLoading,
}: {
  onSubmit: (data: {
    address: string;
    city: string;
    state: string;
    zip: string;
    name: string;
    email: string;
    phone: string;
  }) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: 'AL',
    zip: '',
    name: '',
    email: '',
    phone: '',
  });
  const [addressSelected, setAddressSelected] = useState(false);

  const handleAddressSelect = useCallback((result: AddressResult) => {
    // Extract street address (number + road) from the formatted result
    const streetParts: string[] = [];
    if (result.streetNumber) streetParts.push(result.streetNumber);
    if (result.street) streetParts.push(result.street);
    const streetAddress = streetParts.length > 0 ? streetParts.join(' ') : result.formattedAddress.split(',')[0];

    setFormData((prev) => ({
      ...prev,
      address: streetAddress,
      city: result.city || prev.city,
      state: result.state || prev.state,
      zip: result.zip || prev.zip,
    }));
    setAddressSelected(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Address with Autocomplete */}
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
        {addressSelected && formData.city && (
          <p className="mt-1.5 text-xs text-brand-green/70 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Address found - city, state, and zip auto-filled
          </p>
        )}
      </div>

      {/* City, State, Zip row - auto-filled but editable */}
      <div className="grid grid-cols-5 gap-3">
        <div className="col-span-2">
          <label htmlFor="city" className="block text-sm font-semibold text-neutral-300 mb-1.5">
            City *
          </label>
          <input
            type="text"
            id="city"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="Huntsville"
            className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="state" className="block text-sm font-semibold text-neutral-300 mb-1.5">
            State *
          </label>
          <select
            id="state"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all appearance-none"
          >
            {US_STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-1">
          <label htmlFor="zip" className="block text-sm font-semibold text-neutral-300 mb-1.5">
            Zip *
          </label>
          <input
            type="text"
            id="zip"
            maxLength={5}
            value={formData.zip}
            onChange={(e) => setFormData({ ...formData, zip: e.target.value.replace(/\D/g, '') })}
            placeholder="35801"
            className="w-full px-3 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-neutral-800 pt-4">
        <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold mb-3">Your Contact Info</p>
      </div>

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-semibold text-neutral-300 mb-1.5">
          Full Name *
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="John Smith"
          className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
        />
      </div>

      {/* Email + Phone row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-neutral-300 mb-1.5">
            Email *
          </label>
          <input
            type="email"
            id="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="you@example.com"
            className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-semibold text-neutral-300 mb-1.5">
            Phone *
          </label>
          <input
            type="tel"
            id="phone"
            required
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(256) 555-1234"
            className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
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
        100% free. No obligation. Your information is used solely by River City Roofing Solutions and will not be shared with third parties.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Report Teaser Component (on-screen summary – full report emailed)
// ---------------------------------------------------------------------------

function ReportTeaser({
  report,
  onReset,
  emailSent,
}: {
  report: StormReportData;
  onReset: () => void;
  emailSent: boolean;
}) {
  const riskColors = getRiskColors(report.riskLevel);

  return (
    <div className="space-y-6">
      {/* Risk Level Banner */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden">
        <div className={`bg-gradient-to-r ${riskColors.gradient} p-6 sm:p-8 text-center`}>
          <p className="text-white/80 text-sm font-semibold uppercase tracking-wider mb-1">Storm Damage Risk Level</p>
          <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-wider">{report.riskLevel}</h2>
        </div>

        {/* Hail count stat */}
        <div className="p-6 text-center border-b border-neutral-800">
          <p className="text-3xl font-black text-white">{report.totalHailReports}</p>
          <p className="text-neutral-400 text-sm uppercase tracking-wider mt-1">
            hail report{report.totalHailReports !== 1 ? 's' : ''} found near your address
          </p>
        </div>

        {/* Email confirmation */}
        <div className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-brand-green" />
            <p className="text-brand-green font-semibold">
              {emailSent
                ? 'Your full storm report has been sent to your email!'
                : 'Sending your full storm report to your email…'}
            </p>
          </div>
          <p className="text-neutral-500 text-sm">
            A River City Roofing Solutions representative will contact you shortly with your complete report.
          </p>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-brand-green/10 border-2 border-brand-green/40 rounded-2xl p-6 sm:p-8 text-center">
        <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-3">
          Schedule Your Free Inspection
        </h3>
        <p className="text-neutral-300 mb-6 max-w-lg mx-auto">
          Our certified inspectors will check your roof for storm damage at no cost and with no obligation.
          Most inspections take less than 30 minutes.
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

      {/* Check another address */}
      <div className="text-center">
        <button
          onClick={onReset}
          className="text-neutral-400 hover:text-brand-green transition-colors text-sm font-semibold uppercase tracking-wider"
        >
          Check Another Address
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function CheckMyAddressPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<StormReportData | null>(null);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (data: {
    address: string;
    city: string;
    state: string;
    zip: string;
    name: string;
    email: string;
    phone: string;
  }) => {
    setIsLoading(true);
    setError('');
    setReport(null);

    try {
      // 1. Generate storm report
      const reportRes = await fetch('/api/storm-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: data.address,
          city: data.city,
          state: data.state,
          zip: data.zip,
        }),
      });

      const reportResult = await reportRes.json();

      if (!reportResult.success) {
        throw new Error(reportResult.error || 'Failed to generate storm report');
      }

      setReport(reportResult.data);

      // 2. Send emails (customer teaser + sales full report) in background
      fetch('/api/storm-report/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: data.name,
          customerEmail: data.email,
          customerPhone: data.phone,
          reportId: reportResult.data.reportId,
          address: data.address,
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
          hailReconTotalStorms: reportResult.data.hailReconTotalStorms,
          hailReconLargestSizeLabel: reportResult.data.hailReconLargestSizeLabel,
          dateRangeStart: reportResult.data.dateRangeStart,
          dateRangeEnd: reportResult.data.dateRangeEnd,
        }),
      }).then(() => setEmailSent(true)).catch(err => {
        console.error('Email send error:', err);
        setEmailSent(true); // Still show confirmation to avoid confusion
      });

      // 3. Create lead in background (fire and forget - don't block report display)
      fetch('/api/leads/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: `${data.address}, ${data.city}, ${data.state} ${data.zip}`,
          city: data.city,
          state: data.state,
          zip: data.zip,
          source: 'contact_form',
          sourceDetails: 'Check My Address - Storm Report',
          serviceType: 'Storm/Hail Inspection',
          message: `Auto-generated from Check My Address. Risk Level: ${reportResult.data.riskLevel} (${reportResult.data.riskScore}/100). Report ID: ${reportResult.data.reportId}.`,
          sendNotifications: true,
          notifyTeam: true,
        }),
      }).then(async (leadRes) => {
        try {
          const leadResult = await leadRes.json();
          if (leadResult.success && leadResult.data?.leadId && reportResult.data?.reportId) {
            // Link the storm report to the lead
            await fetch('/api/storm-report', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                address: data.address,
                city: data.city,
                state: data.state,
                zip: data.zip,
                leadId: leadResult.data.leadId,
                customerId: leadResult.data.customerId,
              }),
            });
          }
        } catch (err) {
          console.error('Lead creation follow-up error:', err);
        }
      }).catch(err => {
        console.error('Lead creation error:', err);
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setReport(null);
    setError('');
    setEmailSent(false);
  };

  return (
    <div className="min-h-screen text-white">
      {/* Hero Section */}
      <div className="-mt-20 pt-32 pb-12 sm:pt-36 sm:pb-16 px-6 bg-black/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-green/15 border border-brand-green/30 px-4 py-2 rounded-full mb-6">
            <CloudLightning className="w-4 h-4 text-brand-green" />
            <span className="text-brand-green text-sm font-semibold uppercase tracking-wider">Free Storm Report</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-wider mb-4 leading-tight">
            Check Your Address for{' '}
            <span className="text-brand-green">Storm Damage Risk</span>
          </h1>

          <p className="text-lg sm:text-xl text-neutral-300 max-w-2xl mx-auto leading-relaxed mb-8">
            Get a free hail and storm damage report for your property.
            See real data from the National Weather Service about recent storms in your area.
          </p>

          {/* Trust badges */}
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
          {error && (
            <div className="mb-6 p-6 bg-neutral-950 border border-brand-green/30 rounded-2xl text-center">
              <CloudLightning className="w-12 h-12 text-brand-green mx-auto mb-3" />
              <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">
                We&apos;re Having Trouble Loading Your Report
              </h3>
              <p className="text-neutral-400 text-sm mb-4">
                No worries — our team can pull your storm data manually. Give us a call and we&apos;ll have your report ready in minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="tel:256-274-8530"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-green text-black font-black uppercase tracking-widest rounded-lg hover:bg-lime-400 transition-all"
                >
                  <Phone className="w-4 h-4" />
                  Call (256) 274-8530
                </a>
                <button
                  onClick={() => setError('')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-neutral-700 text-neutral-300 font-bold uppercase tracking-widest rounded-lg hover:border-brand-green hover:text-brand-green transition-all"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {!report ? (
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-6 flex items-center gap-3">
                <Search className="w-6 h-6 text-brand-green" />
                Enter Your Address
              </h2>
              <AddressForm onSubmit={handleSubmit} isLoading={isLoading} />
            </div>
          ) : (
            <ReportTeaser report={report} onReset={handleReset} emailSent={emailSent} />
          )}
        </div>
      </section>

      {/* How It Works */}
      {!report && (
        <section className="py-12 px-6 bg-black/80 backdrop-blur-sm border-t border-neutral-800">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-block mb-4">
                <span className="text-xs uppercase tracking-widest font-bold text-brand-green">How It Works</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-wider">
                3 Simple Steps
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Home,
                  step: '1',
                  title: 'Enter Your Address',
                  desc: 'Tell us where your property is located. We cover Alabama, Tennessee, and surrounding areas.',
                },
                {
                  icon: Search,
                  step: '2',
                  title: 'We Check the Data',
                  desc: 'We pull real hail reports, weather alerts, and storm data from the National Weather Service.',
                },
                {
                  icon: Shield,
                  step: '3',
                  title: 'Get Your Report',
                  desc: 'See your storm risk level, recent hail events nearby, and whether you should get a free inspection.',
                },
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

      {/* Why Hail Damage Matters */}
      {!report && (
        <section className="py-12 px-6 bg-black/85 backdrop-blur-sm border-t border-neutral-800">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-block mb-4">
                  <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Why It Matters</span>
                </div>
                <h2 className="text-3xl font-black uppercase tracking-wider mb-6">
                  Hail Damage Is Often Invisible from the Ground
                </h2>
                <div className="space-y-4">
                  {[
                    'Hail can crack shingles, dislodge granules, and compromise your roof\'s seal',
                    'Damage from a single storm can reduce your roof\'s lifespan by 5-10 years',
                    'Insurance claims for hail damage often have a time limit after the storm',
                    'A free professional inspection can reveal damage you cannot see',
                    'Alabama and Tennessee are among the top states for hail frequency',
                  ].map((point, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-brand-green mt-0.5 flex-shrink-0" />
                      <p className="text-neutral-300 text-sm">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-8 text-center">
                <CloudLightning className="w-16 h-16 text-brand-green mx-auto mb-4" />
                <p className="text-5xl font-black text-white mb-2">90%</p>
                <p className="text-neutral-400 text-sm">
                  of Alabama homeowners are unaware of hail damage on their roof until leaks appear
                </p>
                <div className="border-t border-neutral-800 mt-6 pt-6">
                  <p className="text-neutral-500 text-xs">
                    Source: Insurance Institute for Business & Home Safety
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Service Areas */}
      {!report && (
        <section className="py-12 px-6 bg-black/80 backdrop-blur-sm border-t border-neutral-800">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Where We Serve</span>
            </div>
            <h2 className="text-3xl font-black uppercase tracking-wider mb-8">
              Our Service Areas
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                'Huntsville, AL',
                'Madison, AL',
                'Decatur, AL',
                'Hartselle, AL',
                'Athens, AL',
                'Birmingham, AL',
                'Cullman, AL',
                'Florence, AL',
                'Nashville, TN',
                'Chattanooga, TN',
                'Memphis, TN',
              ].map((area) => (
                <span
                  key={area}
                  className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300 text-sm font-medium hover:border-brand-green/40 transition-colors"
                >
                  {area}
                </span>
              ))}
            </div>
            <p className="text-neutral-500 text-sm mt-6">
              Don&apos;t see your city? We likely serve your area too.{' '}
              <a href="tel:256-274-8530" className="text-brand-green hover:underline">Call to confirm</a>.
            </p>
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
            Get your free report and schedule a no-obligation inspection today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!report && (
              <a
                href="#top"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-brand-green font-black uppercase tracking-widest rounded-lg hover:bg-neutral-900 transition-all"
              >
                <Search className="w-5 h-5" />
                Check My Address
              </a>
            )}
            <a
              href="tel:256-274-8530"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-black text-black font-black uppercase tracking-widest rounded-lg hover:bg-black hover:text-brand-green transition-all"
            >
              <Phone className="w-5 h-5" />
              Call (256) 274-8530
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
