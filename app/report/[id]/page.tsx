'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import {
  Building2, Ruler, TriangleRight, Satellite, Eye, Wrench,
  Wind, Flame, CircleDot, Loader2, AlertTriangle, Shield,
  ShieldCheck, ShieldAlert, CloudLightning, Phone, Mail, MapPin,
  CheckCircle2
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface MeasurementGroup {
  totalFt: number;
  count: number;
  details: { lengthFt: number }[];
  confidence: string;
}

interface RoofComponents {
  flashing: { type: string; length_ft: number; confidence: string }[];
  transitions: { length_ft: number; description: string; confidence: string }[];
  vents: { type: string; count: number; confidence: string }[];
  pipes: { diameter_in: number; count: number; confidence: string }[];
  chimneys: { width_ft: number; length_ft: number; flashing_perimeter_ft: number; confidence: string }[];
  skylights: { width_ft: number; length_ft: number; flashing_perimeter_ft: number; confidence: string }[];
}

interface ReportData {
  reportId: string;
  generatedAt: string;
  address: string;
  lat: number;
  lng: number;
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
  measurements: any;
  components: RoofComponents;
  satelliteImageUrl: string;
  stormReport?: {
    riskLevel: string;
    riskScore: number;
    totalHailReports: number;
    closestHailMiles: number | null;
    largestHailSize: string | null;
    recommendation: string;
    riskFactors: string[];
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

const confColor = (c: string) =>
  c === 'HIGH' ? 'text-green-600' : c === 'MEDIUM' ? 'text-blue-600' : 'text-amber-600';

const confBg = (c: string) =>
  c === 'HIGH' ? 'bg-green-50 border-green-200 text-green-700'
    : c === 'MEDIUM' ? 'bg-blue-50 border-blue-200 text-blue-700'
      : 'bg-amber-50 border-amber-200 text-amber-700';

const ventLabel = (type: string) => {
  const labels: Record<string, string> = { pipe_boot: 'Pipe Boot', box: 'Box Vent', ridge: 'Ridge Vent', turbine: 'Turbine Vent', power: 'Power Vent' };
  return labels[type] || type;
};

const riskConfig: Record<string, { color: string; bg: string; icon: typeof Shield }> = {
  Low: { color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: ShieldCheck },
  Moderate: { color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', icon: Shield },
  High: { color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icon: ShieldAlert },
  Severe: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: ShieldAlert },
};

// ── Main Component ─────────────────────────────────────────────────────────

export default function PublicReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/report/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setReport(data.data);
        } else {
          setError(data.error || 'Report not found');
        }
      })
      .catch(() => setError('Failed to load report'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading your roof report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Report Not Available</h1>
          <p className="text-gray-500">{error || 'This report link may have expired or been disabled.'}</p>
        </div>
      </div>
    );
  }

  const storm = report.stormReport;
  const stormConfig = storm ? (riskConfig[storm.riskLevel] || riskConfig.Low) : null;
  const StormIcon = stormConfig?.icon || Shield;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <Image src="/logo-transparent.png" alt="RCRS" width={56} height={56} className="rounded-xl" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Roof Measurement Report</h1>
              <p className="text-sm text-gray-500">River City Roofing Solutions — AI-Powered Analysis</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Property Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <MapPin className="w-4 h-4" />
                Property Address
              </div>
              <h2 className="text-xl font-bold text-gray-900">{report.address}</h2>
              <p className="text-sm text-gray-400 mt-1">
                Generated {new Date(report.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                {' · '}Report ID: {report.reportId}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${confBg(report.overallConfidence)}`}>
              {report.overallConfidence} Confidence
            </span>
          </div>
        </div>

        {/* Satellite Image */}
        {report.satelliteImageUrl && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="relative aspect-[2/1] max-h-80">
              <img
                src={report.satelliteImageUrl}
                alt="Satellite view"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <Satellite className="w-3 h-3" /> Satellite Imagery
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Roof Area', value: `${report.totalRoofAreaSqFt.toLocaleString()}`, unit: 'sq ft', icon: Building2 },
            { label: 'Roof Squares', value: report.roofSquares.toFixed(1), unit: 'squares', icon: Building2 },
            { label: 'Primary Pitch', value: report.primaryPitch, unit: '', icon: TriangleRight },
            { label: 'Perimeter', value: `${report.perimeterFt.toLocaleString()}`, unit: 'ft', icon: Ruler },
          ].map((m, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <m.icon className="w-5 h-5 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold text-gray-900">{m.value}</div>
              <div className="text-xs text-gray-400">{m.unit}</div>
              <div className="text-xs text-gray-500 mt-1">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Linear Measurements */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Ruler className="w-5 h-5 text-green-600" />
              Linear Measurements
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="text-left px-6 py-3 font-medium">Measurement</th>
                  <th className="text-right px-4 py-3 font-medium">Total (ft)</th>
                  <th className="text-right px-4 py-3 font-medium">Segments</th>
                  <th className="text-center px-4 py-3 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'Ridges', ft: report.totalRidgeFt },
                  { key: 'Rakes', ft: report.totalRakeFt },
                  { key: 'Valleys', ft: report.totalValleyFt },
                  { key: 'Eaves', ft: report.totalEaveFt },
                  { key: 'Hips', ft: report.totalHipFt },
                ].map(m => (
                  <tr key={m.key} className="border-b border-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{m.key}</td>
                    <td className="text-right px-4 py-3 font-mono text-gray-700">{m.ft.toFixed(1)}</td>
                    <td className="text-right px-4 py-3 text-gray-500">—</td>
                    <td className="text-center px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs border ${confBg(report.overallConfidence)}`}>
                        {report.overallConfidence}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Roof Components */}
        {report.components && (
          (() => {
            const c = report.components;
            const hasData = (c.chimneys?.length > 0) || (c.skylights?.length > 0) ||
              (c.vents?.length > 0) || (c.pipes?.length > 0) ||
              (c.flashing?.length > 0);
            if (!hasData) return null;

            return (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-green-600" />
                    Roof Components & Penetrations
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  {c.vents?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                        <Wind className="w-4 h-4 text-cyan-500" /> Vents
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {c.vents.map((v, i) => (
                          <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-gray-900">{v.count}</div>
                            <div className="text-xs text-gray-500">{ventLabel(v.type)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {c.chimneys?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-500" /> Chimneys
                      </h4>
                      {c.chimneys.map((ch, i) => (
                        <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
                          {ch.width_ft}ft × {ch.length_ft}ft · Flashing: {ch.flashing_perimeter_ft}ft
                        </div>
                      ))}
                    </div>
                  )}
                  {c.pipes?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                        <CircleDot className="w-4 h-4 text-gray-500" /> Pipe Penetrations
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {c.pipes.map((p, i) => (
                          <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-gray-900">{p.count}</div>
                            <div className="text-xs text-gray-500">{p.diameter_in}" diameter</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        )}

        {/* Storm Report Section */}
        {storm && (
          <div className={`rounded-2xl border shadow-sm overflow-hidden ${stormConfig?.bg}`}>
            <div className="px-6 py-4 border-b border-gray-200/50">
              <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                <CloudLightning className="w-5 h-5 text-yellow-500" />
                Storm & Hail History
              </h3>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <StormIcon className={`w-8 h-8 ${stormConfig?.color}`} />
                <div>
                  <span className={`text-xl font-bold ${stormConfig?.color}`}>{storm.riskLevel} Risk</span>
                  <span className={`ml-2 text-sm font-medium px-2 py-0.5 rounded-full ${stormConfig?.bg} ${stormConfig?.color}`}>
                    {storm.riskScore}/100
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{storm.totalHailReports}</div>
                  <div className="text-xs text-gray-500">Hail Reports (90d)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {storm.closestHailMiles !== null ? `${storm.closestHailMiles.toFixed(1)} mi` : '—'}
                  </div>
                  <div className="text-xs text-gray-500">Closest Hail</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{storm.largestHailSize || '—'}</div>
                  <div className="text-xs text-gray-500">Largest Hail</div>
                </div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{storm.recommendation}</p>
            </div>
          </div>
        )}

        {/* Additional Info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Roof Style</span>
              <p className="font-medium text-gray-900 capitalize">{report.roofStyle}</p>
            </div>
            <div>
              <span className="text-gray-500">Roof Segments</span>
              <p className="font-medium text-gray-900">{report.segmentCount}</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-green-600 rounded-2xl p-6 text-center text-white shadow-lg">
          <h3 className="text-xl font-bold mb-2">Ready for a Free Inspection?</h3>
          <p className="text-green-100 mb-4 text-sm">Our team will verify these measurements and provide a detailed estimate.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="tel:2562748530"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-green-700 font-semibold rounded-xl hover:bg-green-50 transition-colors"
            >
              <Phone className="w-4 h-4" /> Call (256) 274-8530
            </a>
            <a
              href="mailto:info@rcrsal.com"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 transition-colors"
            >
              <Mail className="w-4 h-4" /> Email Us
            </a>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-gray-400 py-4">
          <p>© {new Date().getFullYear()} River City Roofing Solutions. All rights reserved.</p>
          <p className="mt-1">
            This report uses AI-powered satellite analysis and is intended as an estimate only.
            Actual measurements may vary. A professional inspection is recommended.
          </p>
        </footer>
      </main>
    </div>
  );
}
