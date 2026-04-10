'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Ruler, Home, MapPin, Search, BarChart3, Layers, Sun, Camera, Cpu,
  CheckCircle, AlertCircle, AlertTriangle, Download, Share2, Printer,
  History, ArrowRight, RefreshCw, Zap, Eye, ChevronDown, Clock,
  Loader2, X
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MeasurementCategory {
  totalFt: number;
  count: number;
  confidence: string;
  details: { lengthFt: number; description?: string }[];
}

interface EngineResult {
  engine: string;
  ridges: { lengthFt: number }[];
  rakes: { lengthFt: number }[];
  valleys: { lengthFt: number }[];
  eaves: { lengthFt: number }[];
  hips: { lengthFt: number }[];
  pitches: string[];
  totalRoofAreaSqFt: number;
  roofStyle: string;
  components: {
    vents: number;
    pipes: number;
    chimneys: number;
    skylights: number;
    flashing: number;
  };
  error?: string;
}

interface SolarData {
  totalArea: number;
  segments: number;
  pitchDegrees: number[];
}

interface MeasurementResult {
  address: string;
  lat: number;
  lng: number;
  solarData: SolarData | null;
  measurements: {
    ridge: MeasurementCategory;
    rake: MeasurementCategory;
    valley: MeasurementCategory;
    eave: MeasurementCategory;
    hip: MeasurementCategory;
  };
  pitch: string;
  roofStyle: string;
  components: EngineResult['components'];
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  qualityNotes: string[];
  images: { source: string; label: string; base64: string }[];
  providerResults: EngineResult[];
  needsMoreImages: boolean;
  reportId?: string;
  savedToSheets?: boolean;
}

interface HistoryEntry {
  address: string;
  date: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reportId?: string;
  result: MeasurementResult;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCENT = '#39FF14';

const PROGRESS_STEPS = [
  { label: 'Geocoding', icon: MapPin, message: 'Locating property address...' },
  { label: 'Solar API', icon: Sun, message: 'Fetching building data from Google Solar API...' },
  { label: 'Collecting Images', icon: Camera, message: 'Collecting satellite & street view images...' },
  { label: 'AI Analysis', icon: Cpu, message: 'Running multi-AI measurement engines...' },
  { label: 'Building Consensus', icon: Zap, message: "Applying Michael's Rule consensus algorithm..." },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cls(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function sumLines(lines: { lengthFt: number }[]): number {
  return lines.reduce((s, l) => s + (l.lengthFt ?? 0), 0);
}

function confidenceColor(c: string): string {
  if (c === 'HIGH') return 'text-green-400';
  if (c === 'MEDIUM') return 'text-yellow-400';
  return 'text-red-400';
}

function confidenceBg(c: string): string {
  if (c === 'HIGH') return 'bg-green-500';
  if (c === 'MEDIUM') return 'bg-yellow-500';
  return 'bg-red-500';
}

function confidenceIcon(c: string) {
  if (c === 'HIGH') return <CheckCircle className="w-5 h-5 text-green-400" />;
  if (c === 'MEDIUM') return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
  return <AlertCircle className="w-5 h-5 text-red-400" />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RoofMeasurePage() {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<MeasurementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    measurements: true,
    components: true,
    images: false,
    engines: false,
    notes: false,
  });
  const [imageModal, setImageModal] = useState<string | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rcrs-roof-measure-history');
      if (saved) setHistory(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Calculator history — local cache only, not business-critical data
  const saveHistory = useCallback((entries: HistoryEntry[]) => {
    setHistory(entries);
    try {
      localStorage.setItem('rcrs-roof-measure-history', JSON.stringify(entries.slice(0, 20)));
    } catch { /* ignore */ }
  }, []);

  // Run measurement
  const handleMeasure = useCallback(async (measureAddress?: string) => {
    const addr = measureAddress || address;
    if (!addr.trim()) return;

    setIsLoading(true);
    setProgressStep(0);
    setElapsed(0);
    setResult(null);
    setError(null);

    // Progress timer
    elapsedRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    progressRef.current = setInterval(() => {
      setProgressStep((prev) => (prev < PROGRESS_STEPS.length - 1 ? prev + 1 : prev));
    }, 8000);

    try {
      const res = await fetch('/api/roof-measure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setResult(data);

      // Add to history
      const entry: HistoryEntry = {
        address: data.address || addr,
        date: new Date().toISOString(),
        confidence: data.overallConfidence,
        reportId: data.reportId,
        result: data,
      };
      saveHistory([entry, ...history.filter((h) => h.address !== entry.address)]);
    } catch (err: any) {
      setError(err.message || 'Measurement failed');
    } finally {
      setIsLoading(false);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    }
  }, [address, history, saveHistory]);

  // Load from history
  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    setResult(entry.result);
    setAddress(entry.address);
    setShowHistory(false);
    setError(null);
  }, []);

  // Print report
  const handlePrint = useCallback(() => {
    if (!result) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const m = result.measurements;
    printWindow.document.write(`
      <html><head><title>Roof Measurement Report - ${result.address}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #222; }
        h1 { color: #111; border-bottom: 2px solid #39FF14; padding-bottom: 8px; }
        h2 { color: #333; margin-top: 24px; }
        table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        th { background: #f5f5f5; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: bold; color: white; }
        .high { background: #22c55e; } .medium { background: #eab308; } .low { background: #ef4444; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <h1>Roof Measurement Report</h1>
      <p><strong>Address:</strong> ${result.address}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      <p><strong>Confidence:</strong> <span class="badge ${result.overallConfidence.toLowerCase()}">${result.overallConfidence}</span></p>
      ${result.reportId ? `<p><strong>Report ID:</strong> ${result.reportId}</p>` : ''}

      <h2>Overview</h2>
      <table>
        <tr><td>Roof Style</td><td>${result.roofStyle}</td></tr>
        <tr><td>Primary Pitch</td><td>${result.pitch}</td></tr>
        <tr><td>Total Roof Area</td><td>${(result.solarData?.totalArea || 0).toLocaleString()} sq ft</td></tr>
        <tr><td>Roof Squares</td><td>${((result.solarData?.totalArea || 0) / 100).toFixed(1)}</td></tr>
      </table>

      <h2>Measurements</h2>
      <table>
        <tr><th>Type</th><th>Total (ft)</th><th>Count</th><th>Confidence</th></tr>
        <tr><td>Ridge</td><td>${m.ridge.totalFt}</td><td>${m.ridge.count}</td><td>${m.ridge.confidence}</td></tr>
        <tr><td>Rake</td><td>${m.rake.totalFt}</td><td>${m.rake.count}</td><td>${m.rake.confidence}</td></tr>
        <tr><td>Valley</td><td>${m.valley.totalFt}</td><td>${m.valley.count}</td><td>${m.valley.confidence}</td></tr>
        <tr><td>Eave</td><td>${m.eave.totalFt}</td><td>${m.eave.count}</td><td>${m.eave.confidence}</td></tr>
        <tr><td>Hip</td><td>${m.hip.totalFt}</td><td>${m.hip.count}</td><td>${m.hip.confidence}</td></tr>
      </table>

      <h2>Components</h2>
      <table>
        <tr><th>Type</th><th>Count</th></tr>
        ${result.components.vents ? `<tr><td>Vents</td><td>${result.components.vents}</td></tr>` : ''}
        ${result.components.pipes ? `<tr><td>Pipe Boots</td><td>${result.components.pipes}</td></tr>` : ''}
        ${result.components.chimneys ? `<tr><td>Chimneys</td><td>${result.components.chimneys}</td></tr>` : ''}
        ${result.components.skylights ? `<tr><td>Skylights</td><td>${result.components.skylights}</td></tr>` : ''}
        ${result.components.flashing ? `<tr><td>Flashing</td><td>${result.components.flashing}</td></tr>` : ''}
      </table>

      <p style="margin-top:40px;color:#999;font-size:12px;">
        Generated by River City Roofing & Solar | Multi-AI Consensus Measurement System
      </p>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  }, [result]);

  // Share report link
  const handleShare = useCallback(async () => {
    if (!result?.reportId) return;
    const url = `${window.location.origin}/report/${result.reportId}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('Report link copied to clipboard!');
    } catch {
      prompt('Copy this link:', url);
    }
  }, [result]);

  // Toggle section
  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ruler className="w-6 h-6" style={{ color: ACCENT }} />
            <div>
              <h1 className="text-xl font-bold">Roof Measurement Tool</h1>
              <p className="text-xs text-gray-400">Multi-AI Consensus System</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History ({history.length})</span>
            </button>
            <a
              href="/command-center/roof-measure/compare"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Compare Engines</span>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* History Sidebar */}
        {showHistory && (
          <div className="w-72 shrink-0">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 sticky top-24">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <History className="w-4 h-4" style={{ color: ACCENT }} />
                Recent Measurements
              </h3>
              {history.length === 0 ? (
                <p className="text-sm text-gray-500">No measurements yet</p>
              ) : (
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                  {history.map((entry, i) => (
                    <button
                      key={i}
                      onClick={() => loadFromHistory(entry)}
                      className="w-full text-left p-3 rounded-lg bg-gray-800 hover:bg-gray-750 transition-colors border border-gray-700 hover:border-gray-600"
                    >
                      <p className="text-sm font-medium truncate">{entry.address}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-400">
                          {new Date(entry.date).toLocaleDateString()}
                        </span>
                        <span className={cls('text-xs font-bold', confidenceColor(entry.confidence))}>
                          {entry.confidence}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Search Bar */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isLoading) handleMeasure();
                  }}
                  placeholder="Enter property address..."
                  className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all"
                  style={{ '--tw-ring-color': ACCENT } as any}
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={() => handleMeasure()}
                disabled={isLoading || !address.trim()}
                className={cls(
                  'px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all whitespace-nowrap',
                  isLoading || !address.trim()
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'text-black hover:brightness-110'
                )}
                style={!isLoading && address.trim() ? { backgroundColor: ACCENT } : {}}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Measuring...
                  </>
                ) : (
                  <>
                    <Ruler className="w-5 h-5" />
                    Measure Roof
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 mb-6">
              <div className="flex flex-col items-center">
                <Loader2 className="w-12 h-12 animate-spin mb-4" style={{ color: ACCENT }} />
                <h2 className="text-xl font-bold mb-1">Measuring Roof</h2>
                <p className="text-gray-400 text-sm mb-6">{address}</p>

                {/* Progress Steps */}
                <div className="w-full max-w-lg mb-6">
                  <div className="flex justify-between mb-2">
                    {PROGRESS_STEPS.map((step, i) => {
                      const Icon = step.icon;
                      const isActive = i === progressStep;
                      const isDone = i < progressStep;
                      return (
                        <div key={step.label} className="flex flex-col items-center gap-1">
                          <div
                            className={cls(
                              'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                              isDone && 'bg-green-500/20',
                              isActive && 'ring-2',
                              !isDone && !isActive && 'bg-gray-800'
                            )}
                            style={isActive ? { backgroundColor: ACCENT + '20', boxShadow: `0 0 0 2px ${ACCENT}` } : {}}
                          >
                            {isDone ? (
                              <CheckCircle className="w-5 h-5 text-green-400" />
                            ) : (
                              <Icon
                                className="w-5 h-5"
                                style={isActive ? { color: ACCENT } : { color: '#6b7280' }}
                              />
                            )}
                          </div>
                          <span
                            className={cls(
                              'text-xs hidden sm:block',
                              isActive && 'font-semibold',
                              !isActive && !isDone && 'text-gray-500'
                            )}
                            style={isActive ? { color: ACCENT } : isDone ? { color: '#22c55e' } : {}}
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        backgroundColor: ACCENT,
                        width: `${Math.min(((progressStep + 1) / PROGRESS_STEPS.length) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <p className="text-sm font-medium mb-2" style={{ color: ACCENT }}>
                  {PROGRESS_STEPS[progressStep].message}
                </p>
                <div className="flex items-center gap-2 text-gray-400 text-xs">
                  <Clock className="w-3 h-3" />
                  <span>Elapsed: {formatTime(elapsed)}</span>
                  <span className="text-gray-600">|</span>
                  <span>Usually takes 1-3 minutes</span>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="bg-red-950/30 border border-red-800 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-400">Measurement Failed</p>
                <p className="text-sm text-red-300 mt-1">{error}</p>
                <button
                  onClick={() => handleMeasure()}
                  className="mt-2 px-4 py-1.5 bg-red-800 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Retry
                </button>
              </div>
            </div>
          )}

          {/* Results */}
          {result && !isLoading && (
            <div className="space-y-4">
              {/* Header with confidence + actions */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      {confidenceIcon(result.overallConfidence)}
                      Measurement Results
                    </h2>
                    <p className="text-sm text-gray-400 mt-0.5">{result.address}</p>
                    {result.reportId && (
                      <p className="text-xs text-gray-500 mt-0.5">Report ID: {result.reportId}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cls(
                        'px-3 py-1 rounded-full text-xs font-bold text-black',
                        confidenceBg(result.overallConfidence)
                      )}
                    >
                      {result.overallConfidence} CONFIDENCE
                    </span>
                    <button
                      onClick={handlePrint}
                      className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                      title="Print Report"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    {result.reportId && (
                      <button
                        onClick={handleShare}
                        className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                        title="Copy Share Link"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (!result) return;
                        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `roof-measurement-${result.address.replace(/[^a-z0-9]/gi, '-')}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                      title="Download JSON"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {result.needsMoreImages && (
                  <div className="mt-3 bg-yellow-950/30 border border-yellow-700 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-300">
                      Low confidence - on-site photos recommended for better accuracy
                    </p>
                  </div>
                )}
              </div>

              {/* Roof Overview Card */}
              <SectionCard
                title="Roof Overview"
                icon={<Home className="w-5 h-5" style={{ color: ACCENT }} />}
                expanded={expandedSections.overview}
                onToggle={() => toggleSection('overview')}
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Total Area" value={`${(result.solarData?.totalArea || 0).toLocaleString()} sqft`} />
                  <StatCard label="Roof Squares" value={((result.solarData?.totalArea || 0) / 100).toFixed(1)} />
                  <StatCard label="Primary Pitch" value={result.pitch} />
                  <StatCard label="Roof Style" value={result.roofStyle} />
                </div>
              </SectionCard>

              {/* Measurements Table */}
              <SectionCard
                title="Measurements"
                icon={<Ruler className="w-5 h-5" style={{ color: ACCENT }} />}
                expanded={expandedSections.measurements}
                onToggle={() => toggleSection('measurements')}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-400 font-medium">Type</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Total (ft)</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Count</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { type: 'Ridge', data: result.measurements.ridge },
                        { type: 'Rake', data: result.measurements.rake },
                        { type: 'Valley', data: result.measurements.valley },
                        { type: 'Eave', data: result.measurements.eave },
                        { type: 'Hip', data: result.measurements.hip },
                      ].map(({ type, data }) => (
                        <tr key={type} className="border-b border-gray-800">
                          <td className="py-2.5 px-3 font-medium">{type}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{data.totalFt}</td>
                          <td className="py-2.5 px-3 text-right">{data.count}</td>
                          <td className="py-2.5 px-3 text-right">
                            <span className={cls('text-xs font-bold', confidenceColor(data.confidence))}>
                              {data.confidence}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              {/* Components Card */}
              <SectionCard
                title="Roof Components"
                icon={<Layers className="w-5 h-5" style={{ color: ACCENT }} />}
                expanded={expandedSections.components}
                onToggle={() => toggleSection('components')}
              >
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: 'Vents', count: result.components.vents },
                    { label: 'Pipe Boots', count: result.components.pipes },
                    { label: 'Chimneys', count: result.components.chimneys },
                    { label: 'Skylights', count: result.components.skylights },
                    { label: 'Flashing', count: result.components.flashing },
                  ]
                    .filter((c) => c.count > 0)
                    .map((c) => (
                      <div key={c.label} className="bg-gray-800 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold" style={{ color: ACCENT }}>
                          {c.count}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{c.label}</p>
                      </div>
                    ))}
                  {Object.values(result.components).every((v) => v === 0) && (
                    <p className="text-sm text-gray-500 col-span-full">No components detected</p>
                  )}
                </div>
              </SectionCard>

              {/* Images Gallery */}
              <SectionCard
                title={`Images Used (${result.images?.length || 0})`}
                icon={<Camera className="w-5 h-5" style={{ color: ACCENT }} />}
                expanded={expandedSections.images}
                onToggle={() => toggleSection('images')}
              >
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {(result.images || []).map((img, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-lg overflow-hidden border border-gray-700 cursor-pointer hover:border-gray-500 transition-colors relative group"
                      onClick={() => setImageModal(img.base64)}
                    >
                      <img
                        src={img.base64}
                        alt={img.label}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                        <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-xs px-1 py-0.5 truncate">
                        {img.label}
                      </p>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* AI Engine Comparison */}
              <SectionCard
                title="AI Engine Results"
                icon={<Cpu className="w-5 h-5" style={{ color: ACCENT }} />}
                expanded={expandedSections.engines}
                onToggle={() => toggleSection('engines')}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 px-2 text-gray-400 font-medium">Engine</th>
                        <th className="text-right py-2 px-2 text-gray-400 font-medium">Ridge</th>
                        <th className="text-right py-2 px-2 text-gray-400 font-medium">Rake</th>
                        <th className="text-right py-2 px-2 text-gray-400 font-medium">Valley</th>
                        <th className="text-right py-2 px-2 text-gray-400 font-medium">Eave</th>
                        <th className="text-right py-2 px-2 text-gray-400 font-medium">Hip</th>
                        <th className="text-right py-2 px-2 text-gray-400 font-medium">Pitch</th>
                        <th className="text-right py-2 px-2 text-gray-400 font-medium">Style</th>
                        <th className="text-center py-2 px-2 text-gray-400 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Consensus row */}
                      <tr className="border-b border-gray-600" style={{ backgroundColor: ACCENT + '10' }}>
                        <td className="py-2 px-2 font-bold" style={{ color: ACCENT }}>
                          CONSENSUS
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold">{result.measurements.ridge.totalFt}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold">{result.measurements.rake.totalFt}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold">{result.measurements.valley.totalFt}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold">{result.measurements.eave.totalFt}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold">{result.measurements.hip.totalFt}</td>
                        <td className="py-2 px-2 text-right font-bold">{result.pitch}</td>
                        <td className="py-2 px-2 text-right font-bold">{result.roofStyle}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={cls('text-xs font-bold', confidenceColor(result.overallConfidence))}>
                            {result.overallConfidence}
                          </span>
                        </td>
                      </tr>
                      {/* Engine rows */}
                      {(result.providerResults || []).map((engine, i) => (
                        <tr key={i} className="border-b border-gray-800">
                          <td className="py-2 px-2 font-medium truncate max-w-[150px]" title={engine.engine}>
                            {engine.engine}
                          </td>
                          {engine.error ? (
                            <td colSpan={7} className="py-2 px-2 text-red-400 text-xs">
                              {engine.error.slice(0, 80)}
                            </td>
                          ) : (
                            <>
                              <td className="py-2 px-2 text-right font-mono">{sumLines(engine.ridges)}</td>
                              <td className="py-2 px-2 text-right font-mono">{sumLines(engine.rakes)}</td>
                              <td className="py-2 px-2 text-right font-mono">{sumLines(engine.valleys)}</td>
                              <td className="py-2 px-2 text-right font-mono">{sumLines(engine.eaves)}</td>
                              <td className="py-2 px-2 text-right font-mono">{sumLines(engine.hips)}</td>
                              <td className="py-2 px-2 text-right">{engine.pitches?.[0] ?? '-'}</td>
                              <td className="py-2 px-2 text-right">{engine.roofStyle}</td>
                            </>
                          )}
                          <td className="py-2 px-2 text-center">
                            {engine.error ? (
                              <AlertCircle className="w-4 h-4 text-red-400 mx-auto" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              {/* Quality Notes */}
              <SectionCard
                title="Quality Notes"
                icon={<CheckCircle className="w-5 h-5" style={{ color: ACCENT }} />}
                expanded={expandedSections.notes}
                onToggle={() => toggleSection('notes')}
              >
                <ul className="space-y-1">
                  {(result.qualityNotes || []).map((note, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ArrowRight className="w-3 h-3 shrink-0 mt-1" style={{ color: ACCENT }} />
                      <span className="text-gray-300">{note}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !result && !error && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
              <Home className="w-16 h-16 mx-auto mb-4 text-gray-700" />
              <h2 className="text-xl font-bold text-gray-400 mb-2">Enter an address to measure</h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                The multi-AI system will analyze satellite imagery, street views, and Google Solar data
                to produce accurate roof measurements with consensus confidence scoring.
              </p>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3 max-w-xl mx-auto">
                {PROGRESS_STEPS.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.label} className="flex flex-col items-center gap-1">
                      <Icon className="w-6 h-6 text-gray-600" />
                      <span className="text-xs text-gray-600">{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image Modal */}
      {imageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setImageModal(null)}
        >
          <button
            className="absolute top-4 right-4 bg-gray-800 p-2 rounded-lg hover:bg-gray-700 z-10"
            onClick={() => setImageModal(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={imageModal}
            alt="Enlarged"
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        <ChevronDown
          className={cls('w-4 h-4 text-gray-400 transition-transform', expanded && 'rotate-180')}
        />
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
