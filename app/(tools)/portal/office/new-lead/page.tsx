'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin, Search, CloudLightning, Users, CheckCircle, ArrowRight,
  ArrowLeft, Loader2, AlertTriangle, AlertCircle, Phone, Mail, User, Home,
  Zap, Award, Clock, Target, Shield, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import AddressAutocomplete, { AddressResult } from '@/components/AddressAutocomplete';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnrichmentData {
  geocoded: {
    lat: number;
    lng: number;
    formattedAddress: string;
    county?: string;
    city?: string;
    state?: string;
    zip?: string;
  } | null;
  nearbyJobs: {
    total: number;
    byRep: Record<string, { count: number; closestMiles: number }>;
    sameStreet: number;
    exactMatch: boolean;
  };
  stormReport: {
    riskLevel: string;
    riskScore: number;
    totalHailReports: number;
    recommendation: string;
    reportId: string;
  } | null;
  repRecommendations: Array<{
    repSlug: string;
    repName: string;
    totalScore: number;
    isAvailable: boolean;
    isEligible: boolean;
    factors: Record<string, { score: number; weight: number; raw: number; explanation: string }>;
    disqualifyReason?: string;
  }>;
}

interface DuplicateMatch {
  source: 'lead' | 'jobnimbus';
  matchedBy: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  status?: string;
  salesRep?: string;
  leadId?: string;
  jnid?: string;
}

type WizardStep = 'info' | 'enrichment' | 'recommend' | 'confirm' | 'summary';

const LEAD_SOURCES = [
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'walk_in', label: 'Walk-In' },
  { value: 'referral', label: 'Referral' },
  { value: 'contact_form', label: 'Website Form' },
  { value: 'door_knock', label: 'Door Knock' },
  { value: 'bni', label: 'BNI' },
  { value: 'insurance_agent', label: 'Insurance Agent' },
  { value: 'other', label: 'Other' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewLeadWizard() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<WizardStep>('info');

  // Step 1: Lead info
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('AL');
  const [zip, setZip] = useState('');
  const [source, setSource] = useState('phone_call');
  const [message, setMessage] = useState('');
  const [addressResult, setAddressResult] = useState<AddressResult | null>(null);

  // Duplicate checking
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [dupChecking, setDupChecking] = useState(false);
  const [dupDismissed, setDupDismissed] = useState(false);
  const dupTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Step 2: Enrichment
  const [enrichment, setEnrichment] = useState<EnrichmentData | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState('');

  // Step 3: Selected rep
  const [selectedRep, setSelectedRep] = useState<string>('');
  const [expandedRep, setExpandedRep] = useState<string>('');

  // Step 4: Options
  const [createPortal, setCreatePortal] = useState(true);
  const [syncToJN, setSyncToJN] = useState(true);
  const [sendNotifications, setSendNotifications] = useState(true);

  // Step 5: Assignment result
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<{
    success: boolean;
    leadId?: string;
    portalUrl?: string;
    jnContactId?: string;
    error?: string;
  } | null>(null);

  // Build full address for enrichment - prefer addressResult from autocomplete
  const fullAddress = addressResult
    ? addressResult.formattedAddress
    : [address, city, state, zip].filter(Boolean).join(', ');

  // Debounced duplicate checking across leads + JobNimbus
  const checkDuplicates = useCallback(async (checkName: string, checkPhone: string, checkEmail: string, checkAddress: string) => {
    // Need at least one meaningful field to search
    const hasName = checkName.trim().length >= 3;
    const hasPhone = checkPhone.replace(/\D/g, '').length >= 7;
    const hasEmail = checkEmail.includes('@');
    const hasAddress = checkAddress.trim().length >= 5;
    if (!hasName && !hasPhone && !hasEmail && !hasAddress) return;

    setDupChecking(true);
    setDupDismissed(false);
    const found: DuplicateMatch[] = [];

    try {
      // Check local leads via /api/leads/search
      const searchPromises: Promise<void>[] = [];

      const queries: string[] = [];
      if (hasName) queries.push(checkName.trim());
      if (hasPhone) queries.push(checkPhone.replace(/\D/g, ''));
      if (hasEmail) queries.push(checkEmail.trim());
      if (hasAddress) queries.push(checkAddress.trim().split(',')[0]); // street portion

      for (const q of queries) {
        searchPromises.push(
          fetch('/api/leads/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: q, limit: 5 }),
          })
            .then(res => res.json())
            .then(data => {
              if (data.success && data.data) {
                for (const lead of data.data) {
                  // Avoid adding the same lead twice
                  if (!found.some(f => f.leadId === lead.leadId)) {
                    found.push({
                      source: 'lead',
                      matchedBy: q === checkPhone.replace(/\D/g, '') ? 'phone' :
                                 q === checkEmail.trim() ? 'email' :
                                 q === checkName.trim() ? 'name' : 'address',
                      name: lead.customerName || '',
                      phone: lead.customerPhone,
                      email: lead.customerEmail,
                      address: lead.customerAddress,
                      status: lead.status,
                      salesRep: lead.salesRepSlug,
                      leadId: lead.leadId,
                    });
                  }
                }
              }
            })
            .catch(() => {})
        );
      }

      // Check JobNimbus via /api/leads/verify-customer
      if (hasName || hasPhone || hasEmail) {
        const nameParts = checkName.trim().split(/\s+/);
        searchPromises.push(
          fetch('/api/leads/verify-customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName: nameParts[0] || '',
              lastName: nameParts.slice(1).join(' ') || '',
              phone: hasPhone ? checkPhone : '',
              email: hasEmail ? checkEmail : '',
            }),
          })
            .then(res => res.json())
            .then(data => {
              if (data.success && data.matches) {
                for (const match of data.matches) {
                  if (!found.some(f => f.jnid === match.jnid)) {
                    found.push({
                      source: 'jobnimbus',
                      matchedBy: match.matchedBy || 'name',
                      name: match.displayName || '',
                      phone: match.phone,
                      email: match.email,
                      address: match.address,
                      status: match.status,
                      salesRep: match.salesRep,
                      jnid: match.jnid,
                    });
                  }
                }
              }
            })
            .catch(() => {})
        );
      }

      await Promise.all(searchPromises);
      setDuplicates(found);
    } catch {
      // Silently fail - duplicate check is advisory
    } finally {
      setDupChecking(false);
    }
  }, []);

  // Trigger debounced duplicate check when relevant fields change
  useEffect(() => {
    if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
    dupTimerRef.current = setTimeout(() => {
      checkDuplicates(name, phone, email, addressResult?.formattedAddress || address);
    }, 800);
    return () => { if (dupTimerRef.current) clearTimeout(dupTimerRef.current); };
  }, [name, phone, email, address, addressResult, checkDuplicates]);

  // Handle address selection from autocomplete
  const handleAddressSelect = useCallback((result: AddressResult) => {
    setAddressResult(result);
    setAddress(result.streetNumber ? `${result.streetNumber} ${result.street || ''}`.trim() : result.street || '');
    setCity(result.city || '');
    setState(result.state || 'AL');
    setZip(result.zip || '');
  }, []);

  // Debounced address enrichment
  const fetchEnrichment = useCallback(async (addr: string) => {
    if (addr.length < 10) return;
    setEnriching(true);
    setEnrichError('');

    try {
      const res = await fetch(`/api/leads/enrich?address=${encodeURIComponent(addr)}`);
      const data = await res.json();
      if (data.success) {
        setEnrichment(data.data);
        // Auto-select top recommended rep
        const topRep = data.data.repRecommendations?.find(
          (r: EnrichmentData['repRecommendations'][0]) => r.isEligible && r.isAvailable
        );
        if (topRep) setSelectedRep(topRep.repSlug);
      } else {
        setEnrichError(data.error || 'Enrichment failed');
      }
    } catch (err) {
      setEnrichError('Failed to enrich address');
    } finally {
      setEnriching(false);
    }
  }, []);

  // Handle step navigation
  const goToEnrichment = () => {
    if (!name || !phone || (!address && !addressResult)) return;
    setStep('enrichment');
    fetchEnrichment(fullAddress);
  };

  const handleAssign = async () => {
    setAssigning(true);
    try {
      // Create the lead via the existing leads/new API
      const res = await fetch('/api/leads/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: email || `${phone.replace(/\D/g, '')}@placeholder.com`,
          phone,
          address: fullAddress,
          city,
          state,
          zip,
          source,
          message: message || undefined,
          assignedRepSlug: selectedRep,
          sendNotifications,
          notifyTeam: sendNotifications,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // If we need to do separate assignment (JN sync + timer)
        if (data.data?.leadId && (syncToJN || createPortal)) {
          const assignRes = await fetch(`/api/leads/${data.data.leadId}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repSlug: selectedRep,
              customerName: name,
              customerEmail: email,
              customerPhone: phone,
              customerAddress: fullAddress,
              createPortal,
              syncToJN,
            }),
          });
          const assignData = await assignRes.json();
          setAssignResult({
            success: true,
            leadId: data.data.leadId,
            portalUrl: data.data.portalUrl,
            jnContactId: assignData.data?.jnContactId,
          });
        } else {
          setAssignResult({
            success: true,
            leadId: data.data.leadId,
            portalUrl: data.data.portalUrl,
          });
        }
        setStep('summary');
      } else {
        setAssignResult({
          success: false,
          error: data.error || 'Failed to create lead',
        });
      }
    } catch (err) {
      setAssignResult({
        success: false,
        error: err instanceof Error ? err.message : 'Assignment failed',
      });
    } finally {
      setAssigning(false);
    }
  };

  // Risk level colors
  const riskColor = (level: string) => {
    switch (level) {
      case 'Severe': return 'text-red-400 bg-red-500/20';
      case 'High': return 'text-orange-400 bg-orange-500/20';
      case 'Moderate': return 'text-yellow-400 bg-yellow-500/20';
      default: return 'text-green-400 bg-green-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <div className="border-b border-neutral-800 bg-neutral-900/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal/dashboard" className="text-neutral-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-brand-green">New Lead Wizard</h1>
              <p className="text-sm text-neutral-400">Enter lead info, review data, assign rep</p>
            </div>
          </div>
          {/* Step indicator */}
          <div className="hidden sm:flex items-center gap-1">
            {(['info', 'enrichment', 'recommend', 'confirm', 'summary'] as WizardStep[]).map((s, i) => (
              <div
                key={s}
                className={`w-2.5 h-2.5 rounded-full ${
                  s === step ? 'bg-brand-green' :
                  (['info', 'enrichment', 'recommend', 'confirm', 'summary'].indexOf(step) > i)
                    ? 'bg-brand-green/50' : 'bg-neutral-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* ── STEP 1: Lead Info ─────────────────────────────────── */}
        {step === 'info' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <User className="w-5 h-5 text-brand-green" />
              Lead Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white placeholder:text-neutral-500 focus:border-brand-green focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(256) 555-1234"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white placeholder:text-neutral-500 focus:border-brand-green focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white placeholder:text-neutral-500 focus:border-brand-green focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Lead Source</label>
                <select
                  value={source}
                  onChange={e => setSource(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white focus:border-brand-green focus:outline-none"
                >
                  {LEAD_SOURCES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-neutral-400 mb-1">Property Address *</label>
              <AddressAutocomplete
                onAddressSelect={handleAddressSelect}
                placeholder="Start typing the property address..."
                required
              />
              {addressResult && (
                <div className="mt-2 grid grid-cols-3 gap-3 text-xs text-neutral-500">
                  <span>City: <span className="text-neutral-300">{addressResult.city || '—'}</span></span>
                  <span>State: <span className="text-neutral-300">{addressResult.state || '—'}</span></span>
                  <span>ZIP: <span className="text-neutral-300">{addressResult.zip || '—'}</span></span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-neutral-400 mb-1">Notes / Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Any details about the lead..."
                rows={2}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white placeholder:text-neutral-500 focus:border-brand-green focus:outline-none resize-none"
              />
            </div>

            {/* Auto duplicate check results */}
            {dupChecking && (
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking for duplicates...
              </div>
            )}

            {!dupChecking && duplicates.length > 0 && !dupDismissed && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-400 font-medium text-sm">
                        {duplicates.length} possible duplicate{duplicates.length > 1 ? 's' : ''} found
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Review before creating a new lead
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDupDismissed(true)}
                    className="text-xs text-neutral-500 hover:text-neutral-300 whitespace-nowrap"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {duplicates.slice(0, 5).map((dup, idx) => (
                    <div key={`${dup.source}-${dup.leadId || dup.jnid || idx}`} className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-white">{dup.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            dup.source === 'jobnimbus' ? 'bg-brand-green/20 text-blue-400' : 'bg-neutral-800 text-neutral-400'
                          }`}>
                            {dup.source === 'jobnimbus' ? 'JobNimbus' : 'Lead'}
                          </span>
                          <span className="text-xs text-neutral-500">
                            matched by {dup.matchedBy}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-neutral-400 space-y-0.5">
                        {dup.phone && <p>Phone: {dup.phone}</p>}
                        {dup.email && <p>Email: {dup.email}</p>}
                        {dup.address && <p>Address: {dup.address}</p>}
                        {(dup.status || dup.salesRep) && (
                          <p>
                            {dup.status && <>Status: <span className="text-neutral-300">{dup.status}</span></>}
                            {dup.status && dup.salesRep && ' | '}
                            {dup.salesRep && <>Rep: <span className="text-neutral-300">{dup.salesRep}</span></>}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={goToEnrichment}
              disabled={!name || !phone || (!address && !addressResult)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-green text-black font-semibold px-6 py-3 rounded-lg hover:bg-brand-green/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next: Analyze Address <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 2: Enrichment ───────────────────────────────── */}
        {step === 'enrichment' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Search className="w-5 h-5 text-brand-green" />
                Address Analysis
              </h2>
              <button onClick={() => setStep('info')} className="text-sm text-neutral-400 hover:text-white flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            </div>

            {enriching && (
              <div className="flex items-center justify-center py-12 text-neutral-400">
                <Loader2 className="w-6 h-6 animate-spin mr-3" />
                Analyzing address, checking storms, scoring reps...
              </div>
            )}

            {enrichError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-medium">Enrichment Error</p>
                  <p className="text-sm text-neutral-400">{enrichError}</p>
                  <button onClick={() => fetchEnrichment(fullAddress)} className="mt-2 text-sm text-brand-green hover:underline">
                    Retry
                  </button>
                </div>
              </div>
            )}

            {enrichment && !enriching && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Geocoded address */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-neutral-400 mb-2">
                    <MapPin className="w-4 h-4" /> Geocoded Address
                  </div>
                  {enrichment.geocoded ? (
                    <div>
                      <p className="text-sm font-medium">{enrichment.geocoded.formattedAddress}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        County: {enrichment.geocoded.county || 'N/A'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-red-400">Could not geocode</p>
                  )}
                </div>

                {/* Nearby jobs */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-neutral-400 mb-2">
                    <Home className="w-4 h-4" /> Nearby Jobs
                  </div>
                  <p className="text-2xl font-bold text-white">{enrichment.nearbyJobs.total}</p>
                  <p className="text-xs text-neutral-500">
                    within 2 miles
                    {enrichment.nearbyJobs.sameStreet > 0 && ` • ${enrichment.nearbyJobs.sameStreet} same street`}
                    {enrichment.nearbyJobs.exactMatch && ' • EXACT MATCH'}
                  </p>
                </div>

                {/* Storm risk */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-neutral-400 mb-2">
                    <CloudLightning className="w-4 h-4" /> Storm Risk
                  </div>
                  {enrichment.stormReport ? (
                    <div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-semibold ${riskColor(enrichment.stormReport.riskLevel)}`}>
                        {enrichment.stormReport.riskLevel} ({enrichment.stormReport.riskScore}/100)
                      </span>
                      <p className="text-xs text-neutral-500 mt-1">
                        {enrichment.stormReport.totalHailReports} hail reports nearby
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">No storm data</p>
                  )}
                </div>
              </div>
            )}

            {enrichment && !enriching && (
              <button
                onClick={() => setStep('recommend')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-green text-black font-semibold px-6 py-3 rounded-lg hover:bg-brand-green/90 transition-colors"
              >
                Next: Rep Recommendations <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* ── STEP 3: Rep Recommendations ──────────────────────── */}
        {step === 'recommend' && enrichment && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-green" />
                Rep Recommendations
              </h2>
              <button onClick={() => setStep('enrichment')} className="text-sm text-neutral-400 hover:text-white flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            </div>

            <div className="space-y-3">
              {enrichment.repRecommendations.map((rep, idx) => (
                <div
                  key={rep.repSlug}
                  className={`bg-neutral-900 border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedRep === rep.repSlug
                      ? 'border-brand-green ring-1 ring-brand-green/30'
                      : 'border-neutral-800 hover:border-neutral-600'
                  } ${!rep.isEligible ? 'opacity-50' : ''}`}
                  onClick={() => rep.isEligible && setSelectedRep(rep.repSlug)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        idx === 0 ? 'bg-brand-green/20 text-brand-green' :
                        idx === 1 ? 'bg-brand-green/20 text-blue-400' :
                        'bg-neutral-800 text-neutral-400'
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium">{rep.repName}</p>
                        {rep.disqualifyReason && (
                          <p className="text-xs text-red-400">{rep.disqualifyReason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-brand-green">
                        {rep.totalScore.toFixed(2)}
                      </span>
                      {selectedRep === rep.repSlug && (
                        <CheckCircle className="w-5 h-5 text-brand-green" />
                      )}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setExpandedRep(expandedRep === rep.repSlug ? '' : rep.repSlug);
                        }}
                        className="text-neutral-400 hover:text-white"
                      >
                        {expandedRep === rep.repSlug ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded score breakdown */}
                  {expandedRep === rep.repSlug && (
                    <div className="mt-3 pt-3 border-t border-neutral-800 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      {Object.entries(rep.factors).map(([key, factor]) => (
                        <div key={key} className="bg-neutral-800/50 rounded p-2">
                          <p className="text-neutral-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                          <p className="font-mono text-white">{factor.raw.toFixed(2)} × {factor.weight}</p>
                          <p className="text-neutral-500 truncate" title={factor.explanation}>{factor.explanation}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep('confirm')}
              disabled={!selectedRep}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-green text-black font-semibold px-6 py-3 rounded-lg hover:bg-brand-green/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next: Confirm Assignment <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 4: Confirm & Assign ─────────────────────────── */}
        {step === 'confirm' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-brand-green" />
                Confirm & Assign
              </h2>
              <button onClick={() => setStep('recommend')} className="text-sm text-neutral-400 hover:text-white flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            </div>

            {/* Summary card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-neutral-400">Customer</p>
                  <p className="font-medium">{name}</p>
                </div>
                <div>
                  <p className="text-neutral-400">Phone</p>
                  <p className="font-medium">{phone}</p>
                </div>
                <div>
                  <p className="text-neutral-400">Address</p>
                  <p className="font-medium">{fullAddress}</p>
                </div>
                <div>
                  <p className="text-neutral-400">Source</p>
                  <p className="font-medium">{LEAD_SOURCES.find(s => s.value === source)?.label}</p>
                </div>
                <div>
                  <p className="text-neutral-400">Assigned Rep</p>
                  <p className="font-medium text-brand-green">
                    {enrichment?.repRecommendations.find(r => r.repSlug === selectedRep)?.repName || selectedRep}
                  </p>
                </div>
                {enrichment?.stormReport && (
                  <div>
                    <p className="text-neutral-400">Storm Risk</p>
                    <p className={`font-medium ${riskColor(enrichment.stormReport.riskLevel).split(' ')[0]}`}>
                      {enrichment.stormReport.riskLevel} ({enrichment.stormReport.riskScore}/100)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createPortal}
                  onChange={e => setCreatePortal(e.target.checked)}
                  className="w-4 h-4 accent-[#39FF14]"
                />
                <span className="text-sm">Create customer portal</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncToJN}
                  onChange={e => setSyncToJN(e.target.checked)}
                  className="w-4 h-4 accent-[#39FF14]"
                />
                <span className="text-sm">Sync to JobNimbus</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendNotifications}
                  onChange={e => setSendNotifications(e.target.checked)}
                  className="w-4 h-4 accent-[#39FF14]"
                />
                <span className="text-sm">Send notifications (email, SMS, team chat)</span>
              </label>
            </div>

            <button
              onClick={handleAssign}
              disabled={assigning}
              className="w-full flex items-center justify-center gap-2 bg-brand-green text-black font-bold px-6 py-3 rounded-lg hover:bg-brand-green/90 disabled:opacity-60 transition-colors"
            >
              {assigning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Assigning...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" /> Assign Lead & Create Portal
                </>
              )}
            </button>

            {assignResult && !assignResult.success && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
                {assignResult.error}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 5: Summary ──────────────────────────────────── */}
        {step === 'summary' && assignResult?.success && (
          <div className="space-y-6 text-center py-8">
            <div className="w-16 h-16 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-brand-green" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-brand-green">Lead Assigned Successfully!</h2>
              <p className="text-neutral-400 mt-1">{name} has been assigned to{' '}
                <span className="text-white font-medium">
                  {enrichment?.repRecommendations.find(r => r.repSlug === selectedRep)?.repName || selectedRep}
                </span>
              </p>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-left max-w-md mx-auto space-y-2 text-sm">
              {assignResult.leadId && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Lead ID</span>
                  <span className="font-mono">{assignResult.leadId}</span>
                </div>
              )}
              {assignResult.portalUrl && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Portal</span>
                  <a href={assignResult.portalUrl} target="_blank" className="text-brand-green hover:underline">
                    View Portal
                  </a>
                </div>
              )}
              {assignResult.jnContactId && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">JN Contact</span>
                  <span className="font-mono text-xs">{assignResult.jnContactId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-400">Response Timer</span>
                <span className="text-green-400">Started</span>
              </div>
              {sendNotifications && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Notifications</span>
                  <span className="text-green-400">Sent</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <button
                onClick={() => {
                  // Reset form for next lead
                  setName(''); setPhone(''); setEmail(''); setAddress('');
                  setCity(''); setZip(''); setMessage('');
                  setAddressResult(null); setDuplicates([]); setDupDismissed(false);
                  setEnrichment(null); setSelectedRep('');
                  setAssignResult(null); setStep('info');
                }}
                className="px-6 py-2.5 bg-brand-green/20 text-brand-green rounded-lg hover:bg-brand-green/30 font-medium transition-colors"
              >
                Enter Another Lead
              </button>
              <Link
                href="/portal/dashboard"
                className="px-6 py-2.5 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 font-medium transition-colors text-center"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
