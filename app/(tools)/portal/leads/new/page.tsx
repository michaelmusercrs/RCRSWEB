'use client';

// New Lead Entry Form
// Allows office staff, managers, and admins to enter new leads
// Features: Google Maps autocomplete, nearby contact intelligence, smart rep assignment

import { useState, useCallback } from 'react';
import { MapPin, User, Phone, Mail, Search, AlertCircle, CheckCircle, ArrowRight, Copy, ExternalLink, Loader2, Link2, UserCheck, CloudLightning, Shield, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';
import AddressAutocomplete, { AddressResult } from '@/components/AddressAutocomplete';

interface NearbyContact {
  name: string;
  address: string;
  distanceMiles: number;
  type: string;
  salesRep: string;
  jobStatus: string;
  lastInteraction: string;
}

interface NearbyRepSummary {
  repSlug: string;
  count: number;
  closestMiles: number | null;
}

interface DistributionScore {
  slug: string;
  name: string;
  score: number;
  isEligible: boolean;
  disqualifyReason?: string;
  factors: Record<string, { score: number; weight: number; raw: number; explanation: string }>;
}

interface JNMatch {
  jnid: string;
  displayName: string;
  email: string;
  phone: string;
  address: string;
  salesRep: string;
  status: string;
  matchedBy: string;
  jobs: Array<{
    jnid: string;
    number: string;
    status: string;
    description: string;
  }>;
}

interface StormReportData {
  reportId: string;
  generatedAt: string;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Severe';
  riskScore: number;
  riskFactors: string[];
  recommendation: string;
  totalHailReports: number;
  closestHailMiles: number | null;
  largestHailSize: string | null;
  largestHailSizeNum: number;
  hailReconTotalStorms: number;
  hailReconLargestSize: number;
  hailReconLargestSizeLabel: string;
  hailEvents: Array<{
    date: string;
    size: string;
    sizeNum: number;
    severity: string;
    distance: number;
    location: string;
  }>;
  windEvents: Array<{
    date: string;
    event: string;
    severity: string;
    description: string;
  }>;
  address: string;
  dateRangeStart: string;
  dateRangeEnd: string;
}

interface LeadResult {
  leadId: string;
  customerId: string;
  portalUrl: string;
  qrCodeUrl: string;
  salesRep: {
    name: string;
    slug: string;
    phone: string;
    email: string;
  } | null;
  templates?: {
    sms: Record<string, string>;
    email: Record<string, any>;
  };
  stormReport?: {
    status: string;
    fetchUrl: string;
  };
}

const LEAD_SOURCES = [
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'referral', label: 'Referral' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'contact_form', label: 'Website Form' },
  { value: 'other', label: 'Other' },
];

const SERVICE_TYPES = [
  'Roof Replacement',
  'Roof Repair',
  'Gutter Installation',
  'Gutter Repair',
  'Siding',
  'Insurance Claim',
  'Inspection',
  'Other',
];

const URGENCY_LEVELS = [
  { value: 'normal', label: 'Normal', color: 'text-neutral-400' },
  { value: 'high', label: 'High', color: 'text-yellow-400' },
  { value: 'emergency', label: 'Emergency', color: 'text-red-400' },
];

// Storm Report Risk Level Configuration
const riskLevelConfig: Record<string, { color: string; bgColor: string; borderColor: string; icon: typeof Shield }> = {
  Low: { color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20', icon: ShieldCheck },
  Moderate: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/20', icon: Shield },
  High: { color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/20', icon: ShieldAlert },
  Severe: { color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20', icon: ShieldAlert },
};

function StormReportCard({ report, compact = false }: { report: StormReportData; compact?: boolean }) {
  const config = riskLevelConfig[report.riskLevel] || riskLevelConfig.Low;
  const RiskIcon = config.icon;

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} overflow-hidden`}>
      {/* Risk Level Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center`}>
            <RiskIcon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${config.color}`}>{report.riskLevel} Risk</span>
              <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
                {report.riskScore}/100
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Report ID: {report.reportId} | {new Date(report.generatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="px-4 py-3 border-t border-white/5 grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-lg font-bold text-white">{report.totalHailReports}</div>
          <div className="text-xs text-neutral-500">Hail Reports (90d)</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-white">
            {report.closestHailMiles !== null ? `${report.closestHailMiles.toFixed(1)} mi` : '--'}
          </div>
          <div className="text-xs text-neutral-500">Closest Hail</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-white">
            {report.largestHailSize || '--'}
          </div>
          <div className="text-xs text-neutral-500">Largest Hail</div>
        </div>
      </div>

      {/* Historical Data */}
      {report.hailReconTotalStorms > 0 && (
        <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between text-xs">
          <span className="text-neutral-400">
            HailRecon History: {report.hailReconTotalStorms} storms since 2011
          </span>
          <span className="text-neutral-400">
            Largest: {report.hailReconLargestSizeLabel}
          </span>
        </div>
      )}

      {/* Recommendation */}
      {!compact && (
        <div className="px-4 py-3 border-t border-white/5">
          <p className="text-sm text-neutral-300 leading-relaxed">{report.recommendation}</p>
        </div>
      )}

      {/* Risk Factors */}
      {!compact && report.riskFactors.length > 0 && (
        <div className="px-4 py-3 border-t border-white/5">
          <h4 className="text-xs font-semibold text-neutral-400 uppercase mb-2">Risk Factors</h4>
          <ul className="space-y-1">
            {report.riskFactors.map((factor, i) => (
              <li key={i} className="text-xs text-neutral-400 flex items-start gap-1.5">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.bgColor} ${config.color === 'text-green-400' ? 'bg-green-400' : config.color === 'text-yellow-400' ? 'bg-yellow-400' : config.color === 'text-orange-400' ? 'bg-orange-400' : 'bg-red-400'}`} />
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent Hail Events (expandable in full view) */}
      {!compact && report.hailEvents.length > 0 && (
        <details className="border-t border-white/5">
          <summary className="px-4 py-2 text-xs text-neutral-400 cursor-pointer hover:text-neutral-300">
            View {report.hailEvents.length} hail event{report.hailEvents.length > 1 ? 's' : ''} (90d)
          </summary>
          <div className="px-4 pb-3 space-y-1 max-h-40 overflow-y-auto">
            {report.hailEvents.slice(0, 10).map((event, i) => (
              <div key={i} className="flex justify-between text-xs text-neutral-400 py-1 border-t border-white/5">
                <span>{new Date(event.date).toLocaleDateString()} - {event.size} ({event.severity})</span>
                <span>{event.distance.toFixed(1)} mi | {event.location}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Compact mode recommendation */}
      {compact && (
        <div className="px-4 py-2 border-t border-white/5">
          <p className="text-xs text-neutral-400 line-clamp-2">{report.recommendation}</p>
        </div>
      )}
    </div>
  );
}

export default function NewLeadPage() {
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addressResult, setAddressResult] = useState<AddressResult | null>(null);
  const [source, setSource] = useState('phone_call');
  const [serviceType, setServiceType] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [message, setMessage] = useState('');
  const [referrerName, setReferrerName] = useState('');
  const [referrerRep, setReferrerRep] = useState('');

  // Address intelligence state
  const [nearbyContacts, setNearbyContacts] = useState<NearbyContact[]>([]);
  const [nearbyByRep, setNearbyByRep] = useState<NearbyRepSummary[]>([]);
  const [nearbyCount, setNearbyCount] = useState(0);
  const [exactMatches, setExactMatches] = useState(0);
  const [sameStreetCount, setSameStreetCount] = useState(0);
  const [addressCounty, setAddressCounty] = useState('');
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);

  // JN verification state
  const [jnSearching, setJnSearching] = useState(false);
  const [jnMatches, setJnMatches] = useState<JNMatch[]>([]);
  const [selectedJnContact, setSelectedJnContact] = useState<JNMatch | null>(null);
  const [jnChecked, setJnChecked] = useState(false);

  // Storm report state
  const [stormReport, setStormReport] = useState<StormReportData | null>(null);
  const [isLoadingStormReport, setIsLoadingStormReport] = useState(false);
  const [stormReportError, setStormReportError] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [leadResult, setLeadResult] = useState<LeadResult | null>(null);
  const [distributionScores, setDistributionScores] = useState<DistributionScore[]>([]);
  const [copied, setCopied] = useState('');

  // Post-submission storm report state (fetched after lead creation)
  const [leadStormReport, setLeadStormReport] = useState<StormReportData | null>(null);
  const [isLoadingLeadStormReport, setIsLoadingLeadStormReport] = useState(false);

  // Check JobNimbus for existing customer
  const handleJnVerify = async () => {
    if (!firstName && !phone && !email) return;
    setJnSearching(true);
    setJnMatches([]);
    setSelectedJnContact(null);

    try {
      const response = await fetch('/api/leads/verify-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, phone, email }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setJnMatches(data.matches || []);
        }
      }
    } catch (err) {
      console.error('JN verification error:', err);
    } finally {
      setJnSearching(false);
      setJnChecked(true);
    }
  };

  // When address is selected, search for nearby contacts
  const handleAddressSelect = async (result: AddressResult) => {
    setAddressResult(result);
    setAddressCounty(result.county || '');
    setIsSearchingNearby(true);

    try {
      const response = await fetch('/api/leads/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: result.formattedAddress,
          radiusMiles: 2.0,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setNearbyContacts(data.data.nearbyContacts || []);
          setNearbyByRep(data.data.nearbyByRep || []);
          setNearbyCount(data.data.nearbyCount || 0);
          setExactMatches(data.data.exactMatches || 0);
          setSameStreetCount(data.data.sameStreetCount || 0);
        }
      }
    } catch (err) {
      console.error('Error searching nearby:', err);
    } finally {
      setIsSearchingNearby(false);
    }
  };

  // Pull storm report for the current address (manual trigger)
  const pullStormReport = useCallback(async (addr?: AddressResult) => {
    const target = addr || addressResult;
    if (!target) return;

    setIsLoadingStormReport(true);
    setStormReportError('');
    setStormReport(null);

    try {
      const response = await fetch('/api/storm-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: target.formattedAddress,
          city: target.city || '',
          state: target.state || 'AL',
          zip: target.zip || '',
        }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        setStormReport({
          reportId: data.data.reportId,
          generatedAt: data.data.generatedAt,
          riskLevel: data.data.riskLevel,
          riskScore: data.data.riskScore,
          riskFactors: data.data.riskFactors || [],
          recommendation: data.data.recommendation,
          totalHailReports: data.data.totalHailReports || 0,
          closestHailMiles: data.data.closestHailMiles,
          largestHailSize: data.data.largestHailSize,
          largestHailSizeNum: data.data.largestHailSizeNum || 0,
          hailReconTotalStorms: data.data.hailReconTotalStorms || 0,
          hailReconLargestSize: data.data.hailReconLargestSize || 0,
          hailReconLargestSizeLabel: data.data.hailReconLargestSizeLabel || 'None',
          hailEvents: data.data.hailEvents || [],
          windEvents: data.data.windEvents || [],
          address: data.data.fullAddress || target.formattedAddress,
          dateRangeStart: data.data.dateRangeStart,
          dateRangeEnd: data.data.dateRangeEnd,
        });
      } else {
        setStormReportError(data.error || 'Failed to generate storm report');
      }
    } catch (err) {
      setStormReportError(err instanceof Error ? err.message : 'Storm report request failed');
    } finally {
      setIsLoadingStormReport(false);
    }
  }, [addressResult]);

  // Fetch storm report for a created lead (polls until available)
  const fetchLeadStormReport = useCallback(async (leadId: string, retries = 0) => {
    if (retries > 5) return; // max 5 retries (~25 seconds)

    setIsLoadingLeadStormReport(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/storm-report`);
      const data = await response.json();

      if (data.success && data.data?.latest) {
        setLeadStormReport({
          reportId: data.data.latest.reportId,
          generatedAt: data.data.latest.generatedAt,
          riskLevel: data.data.latest.riskLevel,
          riskScore: data.data.latest.riskScore,
          riskFactors: data.data.latest.riskFactors || [],
          recommendation: data.data.latest.recommendation,
          totalHailReports: data.data.latest.totalHailReports || 0,
          closestHailMiles: data.data.latest.closestHailMiles,
          largestHailSize: data.data.latest.largestHailSize,
          largestHailSizeNum: data.data.latest.largestHailSizeNum || 0,
          hailReconTotalStorms: data.data.latest.hailReconTotalStorms || 0,
          hailReconLargestSize: data.data.latest.hailReconLargestSize || 0,
          hailReconLargestSizeLabel: data.data.latest.hailReconLargestSizeLabel || 'None',
          hailEvents: data.data.latest.hailEvents || [],
          windEvents: data.data.latest.windEvents || [],
          address: data.data.latest.address,
          dateRangeStart: data.data.latest.dateRangeStart,
          dateRangeEnd: data.data.latest.dateRangeEnd,
        });
        setIsLoadingLeadStormReport(false);
      } else if (data.count === 0 && retries < 5) {
        // Report not yet generated, retry after delay
        setTimeout(() => fetchLeadStormReport(leadId, retries + 1), 5000);
      } else {
        setIsLoadingLeadStormReport(false);
      }
    } catch {
      if (retries < 5) {
        setTimeout(() => fetchLeadStormReport(leadId, retries + 1), 5000);
      } else {
        setIsLoadingLeadStormReport(false);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    const fullName = `${firstName} ${lastName}`.trim();
    if (!fullName || !phone || !email || !addressResult) {
      setSubmitError('Please fill in all required fields and select an address.');
      setIsSubmitting(false);
      return;
    }

    try {
      // Step 1: Create the lead via existing API
      const leadResponse = await fetch('/api/leads/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName,
          email,
          phone,
          address: addressResult.formattedAddress,
          city: addressResult.city,
          state: addressResult.state,
          zip: addressResult.zip,
          source,
          sourceDetails: source === 'referral' ? `Referred by ${referrerName}` : undefined,
          serviceType,
          message,
          urgency,
          notifyTeam: true,
          jobnimbusContactId: selectedJnContact?.jnid || undefined,
        }),
      });

      const leadData = await leadResponse.json();

      if (!leadData.success) {
        setSubmitError(leadData.error || 'Failed to create lead');
        setIsSubmitting(false);
        return;
      }

      // Distribution scores are now returned directly from /api/leads/new
      // (no separate /api/leads/distribute call needed - avoids double-distribution)
      if (leadData.data?.distributionScores?.length) {
        setDistributionScores(leadData.data.distributionScores);
      }

      const createdLeadId = leadData.data?.leadId;

      setLeadResult({
        leadId: createdLeadId,
        customerId: leadData.data?.customerId,
        portalUrl: leadData.data?.portalUrl,
        qrCodeUrl: leadData.data?.qrCodeUrl,
        salesRep: leadData.data?.salesRep || null,
        templates: leadData.data?.templates,
        stormReport: leadData.data?.stormReport,
      });

      // If we already have a pre-submission storm report, use it
      // Otherwise, start polling for the auto-generated one
      if (stormReport) {
        setLeadStormReport(stormReport);
      } else if (createdLeadId) {
        // Poll for the auto-generated storm report (fire-and-forget runs server-side)
        setTimeout(() => fetchLeadStormReport(createdLeadId), 3000);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  // Success state - show result
  if (leadResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/[0.02] rounded-xl p-8 border border-brand-green/30">
            <div className="text-center mb-8">
              <CheckCircle className="w-16 h-16 text-brand-green mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-white">Lead Created Successfully!</h1>
              <p className="text-neutral-400 mt-2">Lead ID: {leadResult.leadId}</p>
            </div>

            {leadResult.salesRep && (
              <div className="bg-white/5 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-semibold text-brand-green mb-2">Assigned Sales Rep</h3>
                <p className="text-white text-lg font-medium">{leadResult.salesRep.name}</p>
              </div>
            )}

            <div className="space-y-4">
              {leadResult.portalUrl && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-brand-green mb-2">Customer Portal</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={leadResult.portalUrl}
                      readOnly
                      className="flex-1 bg-white/[0.02] border border-white/10 rounded px-3 py-2 text-white text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(leadResult.portalUrl, 'portal')}
                      className="px-3 py-2 bg-brand-green hover:bg-brand-green/90 text-white rounded text-sm transition-colors"
                    >
                      {copied === 'portal' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a
                      href={leadResult.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded text-sm transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}

              {leadResult.qrCodeUrl && (
                <div className="bg-white/5 rounded-lg p-4 text-center">
                  <h3 className="text-sm font-semibold text-brand-green mb-3">QR Code</h3>
                  <img
                    src={leadResult.qrCodeUrl}
                    alt="Customer Portal QR Code"
                    className="w-40 h-40 mx-auto bg-white p-2 rounded-lg"
                  />
                </div>
              )}

              {leadResult.templates?.sms?.combined && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-brand-green mb-2">SMS Template</h3>
                  <p className="text-neutral-300 text-sm">{leadResult.templates.sms.combined}</p>
                  <button
                    onClick={() => copyToClipboard(leadResult.templates!.sms.combined, 'sms')}
                    className="mt-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition-colors"
                  >
                    {copied === 'sms' ? 'Copied!' : 'Copy SMS'}
                  </button>
                </div>
              )}
            </div>

            {distributionScores.length > 0 && (
              <div className="mt-6 bg-white/5 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-brand-green mb-3">Distribution Scores</h3>
                <div className="space-y-2">
                  {distributionScores.slice(0, 5).map((score, i) => (
                    <div key={score.slug} className="flex items-center justify-between text-sm">
                      <span className={`${i === 0 ? 'text-brand-green font-medium' : 'text-neutral-400'}`}>
                        {i === 0 && '★ '}{score.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-white/[0.02] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${i === 0 ? 'bg-brand-green' : 'bg-white/5'}`}
                            style={{ width: `${Math.min(score.score, 100)}%` }}
                          />
                        </div>
                        <span className={`w-12 text-right ${i === 0 ? 'text-brand-green' : 'text-neutral-500'}`}>
                          {score.score.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Storm Report Results */}
            {(leadStormReport || isLoadingLeadStormReport) && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                  <CloudLightning className="w-4 h-4" />
                  Storm / Hail Report
                </h3>
                {isLoadingLeadStormReport && !leadStormReport ? (
                  <div className="bg-white/5 rounded-lg p-4 flex items-center gap-3 justify-center text-neutral-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating storm report for this address...
                  </div>
                ) : leadStormReport ? (
                  <StormReportCard report={leadStormReport} />
                ) : null}
              </div>
            )}

            <div className="mt-8 flex gap-4">
              <button
                onClick={() => {
                  setLeadResult(null);
                  setDistributionScores([]);
                  setFirstName('');
                  setLastName('');
                  setPhone('');
                  setEmail('');
                  setAddressResult(null);
                  setSource('phone_call');
                  setServiceType('');
                  setMessage('');
                  setNearbyContacts([]);
                  setNearbyByRep([]);
                  setNearbyCount(0);
                  setJnMatches([]);
                  setSelectedJnContact(null);
                  setJnChecked(false);
                  setStormReport(null);
                  setStormReportError('');
                  setLeadStormReport(null);
                }}
                className="flex-1 px-6 py-3 bg-brand-green hover:bg-brand-green/90 text-black font-medium rounded-lg transition-colors"
              >
                Enter Another Lead
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">New Lead</h1>
          <p className="text-neutral-400 mt-1">Enter lead information for smart rep assignment</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <div className="bg-white/[0.02] rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-brand-green" />
              Customer Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">First Name *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-brand-green/50 focus:border-brand-green/50"
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-brand-green/50 focus:border-brand-green/50"
                  placeholder="Last name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-brand-green/50 focus:border-brand-green/50"
                  placeholder="(256) 555-1234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-brand-green/50 focus:border-brand-green/50"
                  placeholder="customer@email.com"
                />
              </div>
            </div>
          </div>

          {/* JobNimbus Verification */}
          <div className="bg-white/[0.02] rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-brand-green" />
              JobNimbus Verification
            </h2>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleJnVerify}
                disabled={jnSearching || (!firstName && !phone && !email)}
                className="px-4 py-2 bg-brand-green hover:bg-brand-green disabled:bg-neutral-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {jnSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Check JobNimbus
                  </>
                )}
              </button>
              <span className="text-xs text-neutral-500">
                {!firstName && !phone && !email
                  ? 'Enter name, phone, or email first'
                  : 'Search for existing customer in JN'}
              </span>
            </div>

            {/* Results */}
            {jnChecked && !jnSearching && (
              <div className="mt-4">
                {jnMatches.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-green-400 bg-green-400/10 px-3 py-2 rounded-lg">
                    <CheckCircle className="w-4 h-4" />
                    No existing customer found — safe to create new lead
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-400/10 px-3 py-2 rounded-lg">
                      <AlertCircle className="w-4 h-4" />
                      {jnMatches.length} existing customer{jnMatches.length > 1 ? 's' : ''} found in JobNimbus
                    </div>

                    {jnMatches.map(match => (
                      <div
                        key={match.jnid}
                        className={`rounded-lg p-4 border transition-colors ${
                          selectedJnContact?.jnid === match.jnid
                            ? 'bg-brand-green/10 border-blue-500/30'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium">{match.displayName}</p>
                            <div className="mt-1 space-y-0.5 text-sm text-neutral-400">
                              {match.address && <p>{match.address}</p>}
                              {match.email && <p>{match.email}</p>}
                              {match.phone && <p>{match.phone}</p>}
                              <p>
                                Rep: <span className="text-neutral-300">{match.salesRep}</span>
                                {' | '}
                                Status: <span className="text-neutral-300">{match.status}</span>
                                {' | '}
                                Matched by: <span className="text-blue-400">{match.matchedBy}</span>
                              </p>
                            </div>
                            {match.jobs.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-neutral-500 uppercase font-semibold">Jobs ({match.jobs.length})</p>
                                {match.jobs.slice(0, 3).map(job => (
                                  <p key={job.jnid} className="text-xs text-neutral-400 mt-0.5">
                                    #{job.number} — {job.status} {job.description && `— ${job.description.slice(0, 60)}`}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            {selectedJnContact?.jnid === match.jnid ? (
                              <button
                                type="button"
                                onClick={() => setSelectedJnContact(null)}
                                className="px-3 py-1.5 bg-brand-green text-black text-xs font-medium rounded-lg flex items-center gap-1"
                              >
                                <Link2 className="w-3 h-3" />
                                Linked
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedJnContact(match)}
                                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                              >
                                <Link2 className="w-3 h-3" />
                                Link
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {!selectedJnContact && (
                      <p className="text-xs text-neutral-500">
                        Link to an existing contact, or continue to create a new lead.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Address */}
          <div className="bg-white/[0.02] rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-green" />
              Property Address
            </h2>

            <AddressAutocomplete
              onAddressSelect={handleAddressSelect}
              placeholder="Start typing the property address..."
              required
            />

            {/* Address Intelligence */}
            {isSearchingNearby && (
              <div className="mt-4 flex items-center gap-2 text-neutral-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching for nearby customers...
              </div>
            )}

            {addressResult && !isSearchingNearby && (
              <div className="mt-4 space-y-3">
                {addressCounty && (
                  <div className="text-sm text-neutral-400">
                    County: <span className="text-white font-medium">{addressCounty}</span>
                  </div>
                )}

                {exactMatches > 0 && (
                  <div className="flex items-center gap-2 text-yellow-400 text-sm bg-yellow-400/10 px-3 py-2 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    Previous customer at this address!
                  </div>
                )}

                {sameStreetCount > 0 && (
                  <div className="text-sm text-blue-400 bg-blue-400/10 px-3 py-2 rounded-lg">
                    {sameStreetCount} previous customer{sameStreetCount > 1 ? 's' : ''} on this street
                  </div>
                )}

                {nearbyCount > 0 && (
                  <div className="text-sm text-brand-green bg-green-400/10 px-3 py-2 rounded-lg">
                    {nearbyCount} previous customer{nearbyCount > 1 ? 's' : ''} within 2 miles
                  </div>
                )}

                {nearbyByRep.length > 0 && (
                  <div className="bg-white/5 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-neutral-400 uppercase mb-2">Nearby by Rep</h4>
                    <div className="space-y-1">
                      {nearbyByRep.map(rep => (
                        <div key={rep.repSlug} className="flex justify-between text-sm">
                          <span className="text-neutral-300">{rep.repSlug}</span>
                          <span className="text-neutral-500">
                            {rep.count} customer{rep.count > 1 ? 's' : ''}
                            {rep.closestMiles !== null && ` (closest: ${rep.closestMiles} mi)`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {nearbyContacts.length > 0 && (
                  <details className="bg-white/5 rounded-lg">
                    <summary className="px-3 py-2 text-sm text-neutral-400 cursor-pointer hover:text-neutral-300">
                      View {nearbyContacts.length} nearby contacts
                    </summary>
                    <div className="px-3 pb-3 space-y-1 max-h-48 overflow-y-auto">
                      {nearbyContacts.map((c, i) => (
                        <div key={i} className="flex justify-between text-xs text-neutral-400 py-1 border-t border-white/10">
                          <span className="truncate flex-1">{c.name} - {c.address}</span>
                          <span className="ml-2 whitespace-nowrap text-neutral-500">{c.distanceMiles} mi | {c.salesRep}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Static Map */}
                {addressResult.lat && addressResult.lng && (
                  <div className="rounded-lg overflow-hidden border border-white/10">
                    <img
                      src={`https://maps.googleapis.com/maps/api/staticmap?center=${addressResult.lat},${addressResult.lng}&zoom=15&size=600x200&markers=color:green%7C${addressResult.lat},${addressResult.lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                      alt="Map"
                      className="w-full h-[200px] object-cover"
                    />
                  </div>
                )}

                {/* Storm Report Section */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <CloudLightning className="w-4 h-4 text-yellow-400" />
                      Storm / Hail Report
                    </h3>
                    <button
                      type="button"
                      onClick={() => pullStormReport()}
                      disabled={isLoadingStormReport}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 disabled:bg-neutral-700 disabled:cursor-not-allowed text-yellow-400 text-xs font-medium rounded-lg transition-colors"
                    >
                      {isLoadingStormReport ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Pulling Report...
                        </>
                      ) : stormReport ? (
                        <>
                          <RefreshCw className="w-3 h-3" />
                          Refresh Report
                        </>
                      ) : (
                        <>
                          <CloudLightning className="w-3 h-3" />
                          Pull Storm Report
                        </>
                      )}
                    </button>
                  </div>

                  {stormReportError && (
                    <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg mb-3">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {stormReportError}
                    </div>
                  )}

                  {isLoadingStormReport && !stormReport && (
                    <div className="flex items-center gap-2 text-neutral-400 text-sm py-4 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing weather data for this address...
                    </div>
                  )}

                  {stormReport && (
                    <StormReportCard report={stormReport} compact />
                  )}

                  {!stormReport && !isLoadingStormReport && !stormReportError && (
                    <p className="text-xs text-neutral-500">
                      Click &quot;Pull Storm Report&quot; to check hail/storm history, or it will auto-generate when the lead is submitted.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Lead Details */}
          <div className="bg-white/[0.02] rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-brand-green" />
              Lead Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Lead Source *</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-brand-green/50 focus:border-brand-green/50"
                >
                  {LEAD_SOURCES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Service Type</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-brand-green/50 focus:border-brand-green/50"
                >
                  <option value="">Select service type...</option>
                  {SERVICE_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Urgency</label>
                <div className="flex gap-3">
                  {URGENCY_LEVELS.map(u => (
                    <button
                      key={u.value}
                      type="button"
                      onClick={() => setUrgency(u.value)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                        urgency === u.value
                          ? 'bg-white/10 border-brand-green text-white'
                          : 'bg-white/5 border-white/10 text-neutral-400 hover:border-white/20'
                      }`}
                    >
                      <span className={u.color}>{u.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Referral fields */}
            {source === 'referral' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/10">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Referrer Name</label>
                  <input
                    type="text"
                    value={referrerName}
                    onChange={(e) => setReferrerName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-brand-green/50 focus:border-brand-green/50"
                    placeholder="Who referred this lead?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Referrer&#39;s Rep</label>
                  <input
                    type="text"
                    value={referrerRep}
                    onChange={(e) => setReferrerRep(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-brand-green/50 focus:border-brand-green/50"
                    placeholder="Rep slug (e.g. hunter)"
                  />
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-300 mb-1">Notes / Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-brand-green/50 focus:border-brand-green/50 resize-none"
                placeholder="Additional notes about this lead..."
              />
            </div>
          </div>

          {/* Submit */}
          {submitError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-4 bg-brand-green hover:bg-brand-green/90 disabled:bg-neutral-700 disabled:cursor-not-allowed text-black font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating Lead & Assigning Rep...
              </>
            ) : (
              <>
                Create Lead & Assign Rep
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
