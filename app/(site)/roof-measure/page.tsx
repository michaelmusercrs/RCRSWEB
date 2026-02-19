'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Search, MapPin, Loader2, Ruler, CheckCircle, AlertCircle,
  CloudLightning, Home, Hash, Building, Copy, ExternalLink
} from 'lucide-react';

type Step = 'address' | 'measuring' | 'results';

interface RoofResult {
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
}

interface StormResult {
  riskLevel: string;
  riskScore: number;
  hailEventCount: number;
  recommendation: string;
}

export default function RoofMeasureStandalone() {
  const [step, setStep] = useState<Step>('address');
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [progress, setProgress] = useState('');
  const [roofResult, setRoofResult] = useState<RoofResult | null>(null);
  const [stormResult, setStormResult] = useState<StormResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  // Load Google Maps JS
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;
    if (typeof window !== 'undefined' && (window as any).google?.maps) {
      autocompleteRef.current = new google.maps.places.AutocompleteService();
      setMapsLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.onload = () => {
      autocompleteRef.current = new google.maps.places.AutocompleteService();
      setMapsLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  const onAddressChange = (val: string) => {
    setAddress(val);
    if (debounceTimer) clearTimeout(debounceTimer);
    if (val.length < 4) { setSuggestions([]); return; }
    
    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        // Google Places Autocomplete (client-side JS API — no CORS issues)
        if (autocompleteRef.current) {
          autocompleteRef.current.getPlacePredictions(
            { input: val, types: ['address'], componentRestrictions: { country: 'us' } },
            (predictions, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                setSuggestions(predictions.map(p => p.description));
              } else {
                setSuggestions([]);
              }
              setLoadingSuggestions(false);
            }
          );
          return;
        }
        // Fallback: Nominatim
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&countrycodes=us&limit=5&q=${encodeURIComponent(val)}`
        );
        const nomData = await nomRes.json();
        setSuggestions(nomData.map((d: any) => d.display_name));
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);
    setDebounceTimer(timer);
  };

  const selectAddress = (addr: string) => {
    setAddress(addr);
    setSuggestions([]);
  };

  // Run measurement
  const runMeasurement = async () => {
    if (!address.trim()) { setError('Enter an address first'); return; }
    setStep('measuring');
    setMeasuring(true);
    setError('');
    setProgress('Geocoding address...');

    const messages = [
      'Fetching satellite imagery...',
      'Analyzing roof segments with AI...',
      'Calculating measurements...',
      'Pulling storm & hail history...',
      'Generating report...',
    ];
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < messages.length) { setProgress(messages[idx]); idx++; }
    }, 6000);

    try {
      const res = await fetch(`/api/roof-measure?address=${encodeURIComponent(address.trim())}`);
      const data = await res.json();
      clearInterval(interval);

      if (!data.success) throw new Error(data.error || 'Measurement failed');
      setRoofResult(data.report || data.roofReport || data);
      if (data.stormReport) setStormResult(data.stormReport);
      setStep('results');
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || 'Measurement failed');
      setStep('address');
    } finally {
      setMeasuring(false);
    }
  };

  const copyLink = () => {
    if (roofResult?.shareUrl) {
      navigator.clipboard.writeText(roofResult.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const reset = () => {
    setStep('address');
    setAddress('');
    setRoofResult(null);
    setStormResult(null);
    setError('');
    setSuggestions([]);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Ruler className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">RCRS Roof Measure</h1>
            <p className="text-xs text-gray-400">AI Satellite Measurement Tool</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-xl p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* STEP: Address Entry */}
        {step === 'address' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold">Enter Property Address</h2>
              <p className="text-gray-400 text-sm mt-1">We'll measure the roof using satellite imagery</p>
            </div>

            {/* Address input */}
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={address}
                onChange={e => onAddressChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runMeasurement()}
                placeholder="123 Main St, Decatur, AL 35601"
                className="w-full pl-12 pr-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                autoFocus
              />
              {loadingSuggestions && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400 animate-spin" />
              )}
            </div>

            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden divide-y divide-gray-700">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => selectAddress(s)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-700 transition flex items-start gap-3"
                  >
                    <MapPin className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                    <span className="text-sm text-gray-200">{s}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Measure button */}
            <button
              onClick={runMeasurement}
              disabled={!address.trim()}
              className="w-full py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition text-lg mt-4"
            >
              <Ruler className="w-5 h-5" /> Measure Roof
            </button>
          </div>
        )}

        {/* STEP: Measuring */}
        {step === 'measuring' && (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-blue-900/50 border-2 border-blue-500 flex items-center justify-center">
                <Ruler className="w-12 h-12 text-blue-400" />
              </div>
              <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold">Measuring Roof</h3>
              <p className="text-blue-400 text-sm mt-2">{progress}</p>
              <p className="text-gray-500 text-xs mt-4">Typically takes 30-60 seconds</p>
            </div>
            <div className="w-48 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* STEP: Results */}
        {step === 'results' && roofResult && (
          <div className="space-y-4">
            {/* Success */}
            <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
              <div>
                <h3 className="font-semibold text-green-200">Measurement Complete</h3>
                <p className="text-xs text-green-400">Report #{roofResult.reportId}</p>
              </div>
            </div>

            {/* Address */}
            <p className="text-center text-sm text-gray-400 flex items-center justify-center gap-1">
              <MapPin className="w-4 h-4" /> {roofResult.address}
            </p>

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Roof Area" value={`${roofResult.totalRoofAreaSqFt?.toLocaleString()} sq ft`} icon={Home} />
              <Metric label="Squares" value={String(roofResult.roofSquares)} icon={Hash} />
              <Metric label="Primary Pitch" value={roofResult.primaryPitch} icon={Ruler} />
              <Metric label="Style" value={roofResult.roofStyle} icon={Building} />
            </div>

            {/* Linear measurements */}
            <div className="bg-gray-800 rounded-xl p-4 space-y-2">
              <h4 className="font-semibold text-sm text-gray-300">Linear Measurements</h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                <Row label="Ridge" value={`${roofResult.totalRidgeFt} ft`} />
                <Row label="Rake" value={`${roofResult.totalRakeFt} ft`} />
                <Row label="Valley" value={`${roofResult.totalValleyFt} ft`} />
                <Row label="Eave" value={`${roofResult.totalEaveFt} ft`} />
                <Row label="Hip" value={`${roofResult.totalHipFt} ft`} />
                <Row label="Perimeter" value={`${roofResult.perimeterFt} ft`} />
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-700 mt-2">
                <span className="text-xs text-gray-500">Segments: {roofResult.segmentCount}</span>
                <span className="text-xs text-gray-500">•</span>
                <span className={`text-xs font-medium ${
                  roofResult.overallConfidence === 'HIGH' ? 'text-green-400' :
                  roofResult.overallConfidence === 'MEDIUM' ? 'text-yellow-400' : 'text-red-400'
                }`}>Confidence: {roofResult.overallConfidence}</span>
              </div>
            </div>

            {/* Storm report */}
            {stormResult && (
              <div className={`rounded-xl p-4 space-y-2 border ${
                stormResult.riskLevel === 'Severe' ? 'bg-red-900/30 border-red-700' :
                stormResult.riskLevel === 'High' ? 'bg-orange-900/30 border-orange-700' :
                stormResult.riskLevel === 'Moderate' ? 'bg-yellow-900/30 border-yellow-700' :
                'bg-green-900/30 border-green-700'
              }`}>
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <CloudLightning className="w-4 h-4" /> Storm/Hail Report
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-400">Risk:</span> <span className="font-semibold">{stormResult.riskLevel}</span></div>
                  <div><span className="text-gray-400">Score:</span> <span className="font-semibold">{stormResult.riskScore}/100</span></div>
                  <div className="col-span-2"><span className="text-gray-400">Hail Events:</span> <span className="font-semibold">{stormResult.hailEventCount}</span></div>
                </div>
                <p className="text-xs text-gray-400 italic">{stormResult.recommendation}</p>
              </div>
            )}

            {/* Share link */}
            {roofResult.shareUrl && (
              <div className="flex items-center gap-2">
                <input type="text" value={roofResult.shareUrl} readOnly
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400" />
                <button onClick={copyLink}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition flex items-center gap-1 text-xs">
                  {copied ? <><CheckCircle className="w-3.5 h-3.5 text-green-400" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
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
                  className="py-3 px-4 border border-gray-700 rounded-xl hover:bg-gray-800 transition flex items-center gap-2 text-sm">
                  <ExternalLink className="w-4 h-4" /> View
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-blue-900/50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-blue-400" />
      </div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="font-semibold text-sm">{value}</div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
