'use client';

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  Search, Plus, MapPin, User, Phone, Mail, Loader2,
  ChevronRight, CheckCircle, AlertCircle, Ruler, CloudLightning,
  Building, ArrowLeft, Copy, ExternalLink, Home, Hash
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface SearchResult {
  type: 'contact' | 'job';
  contactJnid: string | null;
  jobJnid: string | null;
  contactName: string;
  jobName: string | null;
  jobNumber: string | null;
  jobStatus: string | null;
  address: string;
  phone: string;
  email: string;
}

interface RoofMeasureResult {
  reportId: string;
  address: string;
  totalRoofAreaSqFt: number;
  roofSquares: number;
  segmentCount: number;
  primaryPitch: string;
  roofStyle: string;
  totalRidgeFt: number;
  totalRakeFt: number;
  totalValleyFt: number;
  totalEaveFt: number;
  totalHipFt: number;
  perimeterFt: number;
  overallConfidence: string;
  shareToken: string;
  shareUrl: string;
  satelliteImageUrl: string;
}

interface StormResult {
  riskLevel: string;
  riskScore: number;
  hailEventCount: number;
  recommendation: string;
  reportId: string;
}

type Step = 'select' | 'create' | 'confirm' | 'measuring' | 'results';

// =============================================================================
// Component
// =============================================================================

export default function RoofMeasurePage() {
  const { user } = useAuth();

  // Step state
  const [step, setStep] = useState<Step>('select');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  // Selected job
  const [selected, setSelected] = useState<SearchResult | null>(null);

  // Create new
  const [newContact, setNewContact] = useState({
    firstName: '', lastName: '', phone: '', email: '',
    address: '', city: '', state: 'AL', zip: '',
  });
  const [creating, setCreating] = useState(false);

  // Results
  const [measuring, setMeasuring] = useState(false);
  const [measureProgress, setMeasureProgress] = useState('');
  const [roofResult, setRoofResult] = useState<RoofMeasureResult | null>(null);
  const [stormResult, setStormResult] = useState<StormResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Role check
  const allowedRoles = ['owner', 'admin', 'manager', 'sales'];
  if (user && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-red-800">Access Denied</h2>
          <p className="text-red-600 text-sm mt-1">Only owners, admins, managers, and sales reps can use the roof measure tool.</p>
        </div>
      </div>
    );
  }

  // ── Search ─────────────────────────────────────────────────────────────

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch('/api/portal/roof-measure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', query: q }),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const onSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(val), 400);
  };

  // ── Select a result ────────────────────────────────────────────────────

  const selectResult = (r: SearchResult) => {
    setSelected(r);
    setStep('confirm');
    setError('');
  };

  // ── Create new contact + job ───────────────────────────────────────────

  const handleCreate = async () => {
    const { firstName, lastName, address } = newContact;
    if (!firstName || !lastName || !address) {
      setError('First name, last name, and address are required.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/portal/roof-measure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-job', ...newContact }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const fullAddr = [newContact.address, newContact.city, newContact.state, newContact.zip]
        .filter(Boolean).join(', ');

      setSelected({
        type: 'job',
        contactJnid: data.contact.jnid,
        jobJnid: data.job.jnid,
        contactName: data.contact.name,
        jobName: data.job.name,
        jobNumber: data.job.number,
        jobStatus: 'Lead',
        address: fullAddr,
        phone: newContact.phone,
        email: newContact.email,
      });
      setStep('confirm');
    } catch (err: any) {
      setError(err.message || 'Failed to create job');
    } finally {
      setCreating(false);
    }
  };

  // ── Run measurement ────────────────────────────────────────────────────

  const runMeasurement = async () => {
    if (!selected?.jobJnid || !selected?.contactJnid || !selected?.address) {
      setError('Missing job data. Please select a job with an address.');
      return;
    }
    setStep('measuring');
    setMeasuring(true);
    setError('');
    setMeasureProgress('Geocoding address...');

    const progressMessages = [
      'Fetching satellite imagery...',
      'Analyzing roof segments with AI...',
      'Calculating measurements...',
      'Pulling storm/hail history...',
      'Attaching results to JobNimbus...',
    ];
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < progressMessages.length) {
        setMeasureProgress(progressMessages[idx]);
        idx++;
      }
    }, 8000);

    try {
      const res = await fetch('/api/portal/roof-measure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'measure',
          jobJnid: selected.jobJnid,
          contactJnid: selected.contactJnid,
          address: selected.address,
        }),
      });
      const data = await res.json();
      clearInterval(interval);

      if (!data.success) throw new Error(data.error);
      setRoofResult(data.roofReport);
      setStormResult(data.stormReport);
      setStep('results');
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || 'Measurement failed');
      setStep('confirm');
    } finally {
      setMeasuring(false);
    }
  };

  // ── Copy share link ────────────────────────────────────────────────────

  const copyShareLink = () => {
    if (roofResult?.shareUrl) {
      navigator.clipboard.writeText(roofResult.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Reset ──────────────────────────────────────────────────────────────

  const reset = () => {
    setStep('select');
    setSelected(null);
    setSearchQuery('');
    setSearchResults([]);
    setRoofResult(null);
    setStormResult(null);
    setError('');
    setNewContact({ firstName: '', lastName: '', phone: '', email: '', address: '', city: '', state: 'AL', zip: '' });
  };

  // ═════════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {step !== 'select' && step !== 'results' && (
          <button onClick={() => step === 'create' ? setStep('select') : step === 'confirm' ? setStep('select') : null}
            className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Roof Measure</h1>
          <p className="text-sm text-gray-500">AI-powered satellite roof measurement</p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-red-800 text-sm font-medium">Error</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* ── Step: Select Job ─────────────────────────────────────────── */}
      {step === 'select' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search by name, address, or job #..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />}
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {searchResults.map((r, i) => (
                <button
                  key={`${r.contactJnid}-${r.jobJnid}-${i}`}
                  onClick={() => selectResult(r)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-blue-50 transition text-left"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    r.type === 'job' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    {r.type === 'job' ? <Building className="w-5 h-5 text-blue-600" /> : <User className="w-5 h-5 text-gray-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">{r.contactName}</div>
                    {r.jobName && <div className="text-xs text-blue-600 truncate">{r.jobName} {r.jobNumber ? `#${r.jobNumber}` : ''}</div>}
                    {r.address && <div className="text-xs text-gray-500 truncate flex items-center gap-1"><MapPin className="w-3 h-3" />{r.address}</div>}
                  </div>
                  {r.jobStatus && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">
                      {r.jobStatus}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-4">No results found</p>
          )}

          {/* Create new */}
          <div className="border-t border-gray-100 pt-4">
            <button
              onClick={() => { setStep('create'); setError(''); }}
              className="w-full flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <div className="font-medium text-sm text-gray-900">Create New Job</div>
                <div className="text-xs text-gray-500">Add a new contact & job in JobNimbus</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Create New ─────────────────────────────────────────── */}
      {step === 'create' && (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-700">New Contact & Job</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">First Name *</label>
                <input type="text" value={newContact.firstName}
                  onChange={e => setNewContact(p => ({ ...p, firstName: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Last Name *</label>
                <input type="text" value={newContact.lastName}
                  onChange={e => setNewContact(p => ({ ...p, lastName: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Phone</label>
                <input type="tel" value={newContact.phone}
                  onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Email</label>
                <input type="email" value={newContact.email}
                  onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Street Address *</label>
              <input type="text" value={newContact.address}
                onChange={e => setNewContact(p => ({ ...p, address: e.target.value }))}
                placeholder="123 Main St"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">City</label>
                <input type="text" value={newContact.city}
                  onChange={e => setNewContact(p => ({ ...p, city: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">State</label>
                <input type="text" value={newContact.state}
                  onChange={e => setNewContact(p => ({ ...p, state: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">ZIP</label>
                <input type="text" value={newContact.zip}
                  onChange={e => setNewContact(p => ({ ...p, zip: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
          >
            {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><Plus className="w-4 h-4" /> Create & Continue</>}
          </button>
        </div>
      )}

      {/* ── Step: Confirm ────────────────────────────────────────────── */}
      {step === 'confirm' && selected && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <h3 className="font-semibold text-sm text-blue-900 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Job Selected
            </h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <User className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{selected.contactName}</span>
              </div>
              {selected.jobName && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Building className="w-4 h-4 text-gray-400" />
                  <span>{selected.jobName}</span>
                  {selected.jobNumber && <span className="text-xs text-gray-400">#{selected.jobNumber}</span>}
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-700">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span>{selected.address || 'No address'}</span>
              </div>
              {selected.phone && (
                <div className="flex items-center gap-2 text-gray-500">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{selected.phone}</span>
                </div>
              )}
            </div>
          </div>

          {!selected.address && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
              ⚠️ No address on file. The measurement requires a valid street address.
            </div>
          )}

          <button
            onClick={runMeasurement}
            disabled={!selected.address || !selected.jobJnid}
            className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition text-base"
          >
            <Ruler className="w-5 h-5" /> Run Roof Measurement
          </button>

          <p className="text-center text-xs text-gray-400">
            This will analyze satellite imagery and attach results to the JobNimbus record.
          </p>
        </div>
      )}

      {/* ── Step: Measuring ──────────────────────────────────────────── */}
      {step === 'measuring' && (
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
              <Ruler className="w-10 h-10 text-blue-600" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900">Measuring Roof</h3>
            <p className="text-sm text-gray-500 mt-1">{measureProgress}</p>
            <p className="text-xs text-gray-400 mt-3">This typically takes 30-60 seconds</p>
          </div>
        </div>
      )}

      {/* ── Step: Results ────────────────────────────────────────────── */}
      {step === 'results' && roofResult && (
        <div className="space-y-4">
          {/* Success header */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-green-900">Measurement Complete</h3>
              <p className="text-xs text-green-700">Results attached to JobNimbus • Report #{roofResult.reportId}</p>
            </div>
          </div>

          {/* Address */}
          <div className="text-center">
            <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
              <MapPin className="w-4 h-4" /> {roofResult.address}
            </p>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Roof Area" value={`${roofResult.totalRoofAreaSqFt.toLocaleString()} sq ft`} icon={Home} />
            <MetricCard label="Squares" value={roofResult.roofSquares.toString()} icon={Hash} />
            <MetricCard label="Primary Pitch" value={roofResult.primaryPitch} icon={Ruler} />
            <MetricCard label="Style" value={roofResult.roofStyle} icon={Building} />
          </div>

          {/* Detailed measurements */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-sm text-gray-700">Linear Measurements</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <MeasureRow label="Ridge" value={`${roofResult.totalRidgeFt} ft`} />
              <MeasureRow label="Rake" value={`${roofResult.totalRakeFt} ft`} />
              <MeasureRow label="Valley" value={`${roofResult.totalValleyFt} ft`} />
              <MeasureRow label="Eave" value={`${roofResult.totalEaveFt} ft`} />
              <MeasureRow label="Hip" value={`${roofResult.totalHipFt} ft`} />
              <MeasureRow label="Perimeter" value={`${roofResult.perimeterFt} ft`} />
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200 mt-2">
              <span className="text-xs text-gray-500">Segments: {roofResult.segmentCount}</span>
              <span className="text-xs text-gray-500">•</span>
              <span className={`text-xs font-medium ${
                roofResult.overallConfidence === 'HIGH' ? 'text-green-600' :
                roofResult.overallConfidence === 'MEDIUM' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                Confidence: {roofResult.overallConfidence}
              </span>
            </div>
          </div>

          {/* Storm report */}
          {stormResult && (
            <div className={`rounded-xl p-4 space-y-2 border ${
              stormResult.riskLevel === 'Severe' ? 'bg-red-50 border-red-200' :
              stormResult.riskLevel === 'High' ? 'bg-orange-50 border-orange-200' :
              stormResult.riskLevel === 'Moderate' ? 'bg-yellow-50 border-yellow-200' :
              'bg-green-50 border-green-200'
            }`}>
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <CloudLightning className="w-4 h-4" /> Storm/Hail Report
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Risk Level:</span>{' '}
                  <span className="font-semibold">{stormResult.riskLevel}</span>
                </div>
                <div>
                  <span className="text-gray-500">Score:</span>{' '}
                  <span className="font-semibold">{stormResult.riskScore}/100</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Hail Events:</span>{' '}
                  <span className="font-semibold">{stormResult.hailEventCount}</span>
                </div>
              </div>
              <p className="text-xs text-gray-600 italic">{stormResult.recommendation}</p>
            </div>
          )}

          {/* Share link */}
          {roofResult.shareUrl && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={roofResult.shareUrl}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 bg-gray-50"
              />
              <button onClick={copyShareLink}
                className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition flex items-center gap-1 text-xs font-medium">
                {copied ? <><CheckCircle className="w-3.5 h-3.5 text-green-600" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={reset}
              className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2">
              <Ruler className="w-4 h-4" /> New Measurement
            </button>
            {roofResult.shareUrl && (
              <a href={roofResult.shareUrl} target="_blank" rel="noopener noreferrer"
                className="py-3 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition flex items-center gap-2 text-sm text-gray-700">
                <ExternalLink className="w-4 h-4" /> View Report
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-blue-600" />
      </div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="font-semibold text-sm text-gray-900">{value}</div>
      </div>
    </div>
  );
}

function MeasureRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
