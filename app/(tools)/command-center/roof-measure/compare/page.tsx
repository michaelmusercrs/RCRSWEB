'use client';

import { useState, useCallback } from 'react';
import {
  Ruler, Search, BarChart3, Cpu, CheckCircle, AlertCircle, AlertTriangle,
  ArrowRight, Loader2, Clock, Zap, Home, MapPin, ChevronDown
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EngineComparison {
  engine: string;
  status: 'success' | 'error';
  error?: string;
  ridge: number;
  rake: number;
  valley: number;
  eave: number;
  hip: number;
  totalArea: number;
  pitch: string;
  roofStyle: string;
  components: { vents: number; pipes: number; chimneys: number; skylights: number; flashing: number };
  deviationFromConsensus: {
    ridge: number;
    rake: number;
    valley: number;
    eave: number;
    hip: number;
    average: number;
  };
  isClosestToConsensus: boolean;
  isBiggestOutlier: boolean;
}

interface CompareResult {
  address: string;
  lat: number;
  lng: number;
  consensus: {
    ridge: number;
    rake: number;
    valley: number;
    eave: number;
    hip: number;
    totalArea: number;
    pitch: string;
    roofStyle: string;
    overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  comparisons: EngineComparison[];
  recommendations: string[];
  qualityNotes: string[];
  engineCount: { total: number; successful: number; failed: number };
}

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const ACCENT = '#39FF14';
const METRICS = ['ridge', 'rake', 'valley', 'eave', 'hip'] as const;

function cls(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function deviationColor(dev: number): string {
  if (dev <= 5) return 'text-green-400';
  if (dev <= 15) return 'text-yellow-400';
  return 'text-red-400';
}

function deviationBg(dev: number): string {
  if (dev <= 5) return 'bg-green-500';
  if (dev <= 15) return 'bg-yellow-500';
  return 'bg-red-500';
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RoofMeasureComparePage() {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  const handleCompare = useCallback(async () => {
    if (!address.trim()) return;

    setIsLoading(true);
    setElapsed(0);
    setResult(null);
    setError(null);

    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);

    try {
      const res = await fetch('/api/roof-measure/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Comparison failed');
    } finally {
      setIsLoading(false);
      clearInterval(timer);
    }
  }, [address]);

  // Find max values per metric for bar chart scaling
  const getMaxForMetric = (metric: typeof METRICS[number]): number => {
    if (!result) return 100;
    const values = result.comparisons
      .filter((c) => c.status === 'success')
      .map((c) => c[metric]);
    values.push(result.consensus[metric]);
    return Math.max(...values, 1);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6" style={{ color: ACCENT }} />
            <div>
              <h1 className="text-xl font-bold">AI Engine Comparison</h1>
              <p className="text-xs text-gray-400">Side-by-side measurement analysis</p>
            </div>
          </div>
          <a
            href="/command-center/roof-measure"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
          >
            <Ruler className="w-4 h-4" />
            <span className="hidden sm:inline">Measure Tool</span>
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isLoading) handleCompare();
                }}
                placeholder="Enter property address to compare AI engines..."
                className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all"
                style={{ '--tw-ring-color': ACCENT } as any}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleCompare}
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
                  Running...
                </>
              ) : (
                <>
                  <BarChart3 className="w-5 h-5" />
                  Compare Engines
                </>
              )}
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center mb-6">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: ACCENT }} />
            <h2 className="text-lg font-bold mb-1">Running All AI Engines</h2>
            <p className="text-sm text-gray-400 mb-4">{address}</p>
            <p className="text-sm" style={{ color: ACCENT }}>
              Measuring with each engine separately for comparison...
            </p>
            <div className="flex items-center justify-center gap-2 text-gray-400 text-xs mt-3">
              <Clock className="w-3 h-3" />
              <span>Elapsed: {formatTime(elapsed)} | This may take 2-5 minutes</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="bg-red-950/30 border border-red-800 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-400">Comparison Failed</p>
              <p className="text-sm text-red-300 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !isLoading && (
          <div className="space-y-4">
            {/* Summary Header */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <MapPin className="w-5 h-5" style={{ color: ACCENT }} />
                    {result.address}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {result.engineCount.successful}/{result.engineCount.total} engines successful
                  </p>
                </div>
                <span
                  className={cls(
                    'px-3 py-1 rounded-full text-xs font-bold text-black',
                    confidenceBg(result.consensus.overallConfidence)
                  )}
                >
                  {result.consensus.overallConfidence} CONFIDENCE
                </span>
              </div>

              {/* Consensus summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Roof Style</p>
                  <p className="font-bold">{result.consensus.roofStyle}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Pitch</p>
                  <p className="font-bold">{result.consensus.pitch}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Total Area</p>
                  <p className="font-bold">{result.consensus.totalArea.toLocaleString()} sqft</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Engines Used</p>
                  <p className="font-bold">
                    {result.engineCount.successful}{' '}
                    <span className="text-gray-400 font-normal text-xs">of {result.engineCount.total}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Side-by-Side Comparison Table */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h3 className="font-semibold flex items-center gap-2">
                  <Cpu className="w-5 h-5" style={{ color: ACCENT }} />
                  Engine-by-Engine Comparison
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 bg-gray-800/50">
                      <th className="text-left py-3 px-3 text-gray-400 font-medium">Engine</th>
                      <th className="text-right py-3 px-3 text-gray-400 font-medium">Ridge</th>
                      <th className="text-right py-3 px-3 text-gray-400 font-medium">Rake</th>
                      <th className="text-right py-3 px-3 text-gray-400 font-medium">Valley</th>
                      <th className="text-right py-3 px-3 text-gray-400 font-medium">Eave</th>
                      <th className="text-right py-3 px-3 text-gray-400 font-medium">Hip</th>
                      <th className="text-right py-3 px-3 text-gray-400 font-medium">Pitch</th>
                      <th className="text-right py-3 px-3 text-gray-400 font-medium">Style</th>
                      <th className="text-center py-3 px-3 text-gray-400 font-medium">Avg Dev %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Consensus Row */}
                    <tr className="border-b border-gray-600" style={{ backgroundColor: ACCENT + '10' }}>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4" style={{ color: ACCENT }} />
                          <span className="font-bold" style={{ color: ACCENT }}>CONSENSUS</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">{result.consensus.ridge}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold">{result.consensus.rake}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold">{result.consensus.valley}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold">{result.consensus.eave}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold">{result.consensus.hip}</td>
                      <td className="py-3 px-3 text-right font-bold">{result.consensus.pitch}</td>
                      <td className="py-3 px-3 text-right font-bold">{result.consensus.roofStyle}</td>
                      <td className="py-3 px-3 text-center">-</td>
                    </tr>

                    {/* Engine Rows */}
                    {result.comparisons.map((comp, i) => (
                      <tr
                        key={i}
                        className={cls(
                          'border-b border-gray-800',
                          comp.isClosestToConsensus && 'bg-green-950/20',
                          comp.isBiggestOutlier && comp.status === 'success' && 'bg-red-950/10'
                        )}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {comp.status === 'success' ? (
                              <CheckCircle className="w-4 h-4 text-green-400" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-400" />
                            )}
                            <span className="font-medium truncate max-w-[180px]" title={comp.engine}>
                              {comp.engine}
                            </span>
                            {comp.isClosestToConsensus && (
                              <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-bold">
                                BEST
                              </span>
                            )}
                            {comp.isBiggestOutlier && comp.status === 'success' && (
                              <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-bold">
                                OUTLIER
                              </span>
                            )}
                          </div>
                        </td>
                        {comp.status === 'error' ? (
                          <td colSpan={7} className="py-3 px-3 text-red-400 text-xs">
                            {comp.error?.slice(0, 100)}
                          </td>
                        ) : (
                          <>
                            <td className="py-3 px-3 text-right font-mono">{comp.ridge}</td>
                            <td className="py-3 px-3 text-right font-mono">{comp.rake}</td>
                            <td className="py-3 px-3 text-right font-mono">{comp.valley}</td>
                            <td className="py-3 px-3 text-right font-mono">{comp.eave}</td>
                            <td className="py-3 px-3 text-right font-mono">{comp.hip}</td>
                            <td className="py-3 px-3 text-right">{comp.pitch}</td>
                            <td className="py-3 px-3 text-right">{comp.roofStyle}</td>
                          </>
                        )}
                        <td className="py-3 px-3 text-center">
                          {comp.status === 'success' && (
                            <span className={cls('font-bold', deviationColor(comp.deviationFromConsensus.average))}>
                              {comp.deviationFromConsensus.average.toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Visual Bar Chart Comparison */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" style={{ color: ACCENT }} />
                Measurement Comparison (Bar Chart)
              </h3>
              <div className="space-y-6">
                {METRICS.map((metric) => {
                  const max = getMaxForMetric(metric);
                  const successfulEngines = result.comparisons.filter((c) => c.status === 'success');
                  return (
                    <div key={metric}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        {metric.charAt(0).toUpperCase() + metric.slice(1)}
                      </p>
                      {/* Consensus bar */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs w-28 truncate font-bold" style={{ color: ACCENT }}>
                          Consensus
                        </span>
                        <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden">
                          <div
                            className="h-full rounded"
                            style={{
                              width: `${(result.consensus[metric] / max) * 100}%`,
                              backgroundColor: ACCENT,
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono w-16 text-right font-bold">
                          {result.consensus[metric]} ft
                        </span>
                      </div>
                      {/* Engine bars */}
                      {successfulEngines.map((comp, i) => {
                        const val = comp[metric];
                        const dev = comp.deviationFromConsensus[metric];
                        return (
                          <div key={i} className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs w-28 truncate text-gray-400" title={comp.engine}>
                              {comp.engine.split(' ').slice(0, 2).join(' ')}
                            </span>
                            <div className="flex-1 h-4 bg-gray-800 rounded overflow-hidden">
                              <div
                                className={cls('h-full rounded', deviationBg(dev))}
                                style={{
                                  width: `${(val / max) * 100}%`,
                                  opacity: 0.7,
                                }}
                              />
                            </div>
                            <span className="text-xs font-mono w-16 text-right text-gray-400">
                              {val} ft
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5" style={{ color: ACCENT }} />
                Recommendations
              </h3>
              <ul className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" style={{ color: ACCENT }} />
                    <span className="text-gray-300">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quality Notes (collapsible) */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <button
                onClick={() => setShowNotes(!showNotes)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
              >
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4" style={{ color: ACCENT }} />
                  Quality Notes ({result.qualityNotes.length})
                </h3>
                <ChevronDown
                  className={cls('w-4 h-4 text-gray-400 transition-transform', showNotes && 'rotate-180')}
                />
              </button>
              {showNotes && (
                <div className="px-4 pb-4">
                  <ul className="space-y-1">
                    {result.qualityNotes.map((note, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <ArrowRight className="w-3 h-3 shrink-0 mt-0.5" style={{ color: ACCENT }} />
                        <span className="text-gray-400">{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !result && !error && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-700" />
            <h2 className="text-xl font-bold text-gray-400 mb-2">Compare AI Engine Accuracy</h2>
            <p className="text-sm text-gray-500 max-w-lg mx-auto">
              Enter an address to run all available AI engines and compare their measurements side-by-side.
              See which engines agree, which are outliers, and how each contributes to the consensus result.
            </p>
            <div className="mt-6 flex items-center justify-center gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <Cpu className="w-4 h-4" /> Vertex AI
              </span>
              <span>vs</span>
              <span className="flex items-center gap-1">
                <Cpu className="w-4 h-4" /> Gemini
              </span>
              <span>vs</span>
              <span className="flex items-center gap-1">
                <Cpu className="w-4 h-4" /> Claude
              </span>
              <span>vs</span>
              <span className="flex items-center gap-1">
                <Cpu className="w-4 h-4" /> Ollama
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
