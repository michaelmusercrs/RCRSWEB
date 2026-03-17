'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Calculator, Ruler, Home, Layers, DollarSign,
  Plus, Search, Download, Printer, Send,
  ChevronDown, ChevronRight, Check, Clock,
  Loader2, Package, TrendingUp, BarChart3,
  Hammer, Wrench, Save,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface EstimateInput {
  roofArea: number;
  pitch: string;
  stories: number;
  roofStyle: string;
  currentMaterial: string;
  newMaterial: string;
  tearOff: boolean;
  complexityLevel: string;
  extras: string[];
  measurements?: {
    ridge: number;
    rake: number;
    valley: number;
    eave: number;
    hip: number;
  };
}

interface EstimateResult {
  id: string;
  input: EstimateInput;
  materialCost: number;
  laborCost: number;
  tearOffCost: number;
  extrasCost: Record<string, number>;
  wasteFactorPercent: number;
  wasteCost: number;
  subtotal: number;
  overhead: number;
  profit: number;
  totalEstimate: number;
  squares: number;
  bundlesNeeded: number;
  underlaymentRolls: number;
  ridgeCapLinearFt: number;
  dripEdgeLinearFt: number;
  starterStripLinearFt: number;
  nailPounds: number;
  lowEstimate: number;
  highEstimate: number;
  pricePerSquare: number;
  estimatedDays: number;
  crewSize: number;
  notes: string[];
  createdAt: string;
  customerName?: string;
  address?: string;
  leadId?: string;
}

// =============================================================================
// Constants
// =============================================================================

const PITCH_OPTIONS = ['2/12', '3/12', '4/12', '5/12', '6/12', '7/12', '8/12', '9/12', '10/12', '11/12', '12/12'];

const ROOF_STYLES = [
  { value: 'gable', label: 'Gable' },
  { value: 'hip', label: 'Hip' },
  { value: 'cross-gable', label: 'Cross-Gable' },
  { value: 'mansard', label: 'Mansard' },
  { value: 'flat', label: 'Flat' },
  { value: 'shed', label: 'Shed' },
];

const MATERIALS = [
  { value: '3_tab_asphalt', label: '3-Tab Asphalt', range: '$75-100/sq' },
  { value: 'architectural', label: 'Architectural Asphalt', range: '$100-150/sq' },
  { value: 'designer_asphalt', label: 'Designer Asphalt', range: '$150-250/sq' },
  { value: 'metal_standing_seam', label: 'Metal Standing Seam', range: '$300-500/sq' },
  { value: 'metal_corrugated', label: 'Metal Corrugated', range: '$150-250/sq' },
  { value: 'tpo_flat', label: 'TPO Flat Roof', range: '$150-250/sq' },
  { value: 'modified_bitumen', label: 'Modified Bitumen', range: '$100-200/sq' },
  { value: 'cedar_shake', label: 'Cedar Shake', range: '$350-500/sq' },
  { value: 'synthetic_slate', label: 'Synthetic Slate', range: '$400-700/sq' },
  { value: 'clay_tile', label: 'Clay Tile', range: '$500-1000/sq' },
];

const CURRENT_MATERIALS = [
  { value: 'asphalt', label: 'Asphalt Shingles' },
  { value: 'metal', label: 'Metal' },
  { value: 'tile', label: 'Tile' },
  { value: 'flat', label: 'Flat/BUR' },
  { value: 'wood', label: 'Wood Shake' },
  { value: 'slate', label: 'Slate' },
  { value: 'unknown', label: 'Unknown' },
];

const COMPLEXITY_OPTIONS = [
  { value: 'simple', label: 'Simple', desc: 'Standard gable, minimal penetrations, easy access' },
  { value: 'moderate', label: 'Moderate', desc: 'Multiple planes, some penetrations, standard access' },
  { value: 'complex', label: 'Complex', desc: 'Steep pitch, many valleys/hips, difficult access, multiple stories' },
];

const EXTRAS_OPTIONS = [
  { value: 'skylights', label: 'Skylight Install/Flash', price: '$250-500 each' },
  { value: 'chimney_flash', label: 'Chimney Flashing', price: '$300-600 each' },
  { value: 'ridge_vent', label: 'Ridge Vent', price: '$3-5/ft' },
  { value: 'gutter', label: 'Gutters', price: '$5-15/ft' },
  { value: 'soffit', label: 'Soffit & Fascia', price: '$4-8/ft' },
  { value: 'fascia', label: 'Fascia Only', price: '$3-6/ft' },
  { value: 'drip_edge', label: 'Drip Edge', price: '$1-3/ft' },
  { value: 'ice_water_shield', label: 'Ice & Water Shield', price: '$50-100/sq' },
];

const EXTRAS_LABELS: Record<string, string> = Object.fromEntries(
  EXTRAS_OPTIONS.map(e => [e.value, e.label])
);

// =============================================================================
// Component
// =============================================================================

export default function EstimatesPage() {
  // Calculator form state
  const [roofArea, setRoofArea] = useState<number>(2000);
  const [pitch, setPitch] = useState('6/12');
  const [stories, setStories] = useState(1);
  const [roofStyle, setRoofStyle] = useState('gable');
  const [currentMaterial, setCurrentMaterial] = useState('asphalt');
  const [newMaterial, setNewMaterial] = useState('architectural');
  const [tearOff, setTearOff] = useState(true);
  const [complexityLevel, setComplexityLevel] = useState('moderate');
  const [extras, setExtras] = useState<string[]>([]);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [measurements, setMeasurements] = useState({ ridge: 0, rake: 0, valley: 0, eave: 0, hip: 0 });
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');

  // Result state
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Recent estimates
  const [recentEstimates, setRecentEstimates] = useState<EstimateResult[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Live squares display
  const squares = useMemo(() => (roofArea / 100).toFixed(1), [roofArea]);

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  const fetchRecent = async () => {
    try {
      const res = await fetch('/api/estimates?limit=10');
      const data = await res.json();
      if (data.success) setRecentEstimates(data.estimates);
    } catch (e) {
      console.error('Failed to fetch recent estimates:', e);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    fetchRecent();
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCalculate = async () => {
    if (!roofArea || roofArea <= 0) return;
    setCalculating(true);

    try {
      const input: any = {
        roofArea,
        pitch,
        stories,
        roofStyle,
        currentMaterial,
        newMaterial,
        tearOff,
        complexityLevel,
        extras,
        save: false,
      };

      if (showMeasurements && (measurements.ridge || measurements.rake || measurements.eave)) {
        input.measurements = measurements;
      }
      if (customerName) input.customerName = customerName;
      if (address) input.address = address;

      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.estimate);
      }
    } catch (e) {
      console.error('Failed to calculate estimate:', e);
    } finally {
      setCalculating(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...result.input,
          save: true,
          customerName,
          address,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchRecent();
      }
    } catch (e) {
      console.error('Failed to save estimate:', e);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const loadEstimate = (est: EstimateResult) => {
    setRoofArea(est.input.roofArea);
    setPitch(est.input.pitch);
    setStories(est.input.stories);
    setRoofStyle(est.input.roofStyle);
    setCurrentMaterial(est.input.currentMaterial);
    setNewMaterial(est.input.newMaterial);
    setTearOff(est.input.tearOff);
    setComplexityLevel(est.input.complexityLevel);
    setExtras(est.input.extras);
    if (est.input.measurements) {
      setShowMeasurements(true);
      setMeasurements(est.input.measurements);
    }
    setCustomerName(est.customerName || '');
    setAddress(est.address || '');
    setResult(est);
  };

  const toggleExtra = (value: string) => {
    setExtras(prev =>
      prev.includes(value) ? prev.filter(e => e !== value) : [...prev, value]
    );
  };

  // ---------------------------------------------------------------------------
  // Cost breakdown data for display
  // ---------------------------------------------------------------------------

  const breakdownItems = useMemo(() => {
    if (!result) return [];
    const items: { label: string; value: number; color: string }[] = [
      { label: 'Materials', value: result.materialCost, color: '#3B82F6' },
      { label: 'Labor', value: result.laborCost, color: '#8B5CF6' },
    ];
    if (result.tearOffCost > 0) {
      items.push({ label: 'Tear-Off', value: result.tearOffCost, color: '#EF4444' });
    }
    const extrasTotal = Object.values(result.extrasCost).reduce((s, v) => s + v, 0);
    if (extrasTotal > 0) {
      items.push({ label: 'Extras', value: extrasTotal, color: '#F59E0B' });
    }
    items.push({ label: 'Overhead (15%)', value: result.overhead, color: '#6B7280' });
    items.push({ label: 'Profit (25%)', value: result.profit, color: '#10B981' });
    return items;
  }, [result]);

  const breakdownTotal = useMemo(() => breakdownItems.reduce((s, i) => s + i.value, 0), [breakdownItems]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Calculator className="w-7 h-7 text-[#39FF14]" />
          Quick Estimate Calculator
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Calculate roof replacement estimates with material quantities and pricing
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ================================================================= */}
        {/* LEFT: Calculator Form                                             */}
        {/* ================================================================= */}
        <div className="space-y-5">
          {/* Roof Area */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <h2 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Ruler className="w-4 h-4 text-[#39FF14]" />
              Roof Dimensions
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Roof Area (sq ft) — <span className="text-[#39FF14] font-medium">{squares} squares</span>
                </label>
                <input
                  type="number"
                  value={roofArea}
                  onChange={e => setRoofArea(Number(e.target.value))}
                  min={100}
                  step={100}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]/50"
                  placeholder="2000"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Pitch</label>
                  <select
                    value={pitch}
                    onChange={e => setPitch(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]/50"
                  >
                    {PITCH_OPTIONS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Stories</label>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(s => (
                      <button
                        key={s}
                        onClick={() => setStories(s)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          stories === s
                            ? 'bg-[#39FF14] text-black'
                            : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-white'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Roof Style</label>
                <select
                  value={roofStyle}
                  onChange={e => setRoofStyle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]/50"
                >
                  {ROOF_STYLES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Optional Measurements */}
              <div>
                <button
                  onClick={() => setShowMeasurements(!showMeasurements)}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  {showMeasurements ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Custom Measurements (optional)
                </button>
                {showMeasurements && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {(['ridge', 'rake', 'valley', 'eave', 'hip'] as const).map(field => (
                      <div key={field}>
                        <label className="text-xs text-gray-500 block mb-0.5 capitalize">{field} (ft)</label>
                        <input
                          type="number"
                          value={measurements[field] || ''}
                          onChange={e => setMeasurements({ ...measurements, [field]: Number(e.target.value) })}
                          className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-[#39FF14]/50"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Materials */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <h2 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#39FF14]" />
              Materials
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Current Roof Material</label>
                <select
                  value={currentMaterial}
                  onChange={e => setCurrentMaterial(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]/50"
                >
                  {CURRENT_MATERIALS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">New Material</label>
                <select
                  value={newMaterial}
                  onChange={e => setNewMaterial(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]/50"
                >
                  {MATERIALS.map(m => (
                    <option key={m.value} value={m.value}>
                      {m.label} ({m.range})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-300">Tear-off existing roof</label>
                <button
                  onClick={() => setTearOff(!tearOff)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    tearOff ? 'bg-[#39FF14]' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      tearOff ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Complexity */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <h2 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Home className="w-4 h-4 text-[#39FF14]" />
              Complexity Level
            </h2>
            <div className="space-y-2">
              {COMPLEXITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setComplexityLevel(opt.value)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    complexityLevel === opt.value
                      ? 'bg-[#39FF14]/10 border-[#39FF14]/40 text-white'
                      : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Extras */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <h2 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#39FF14]" />
              Extras & Add-ons
            </h2>
            <div className="space-y-2">
              {EXTRAS_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    extras.includes(opt.value)
                      ? 'bg-[#39FF14]/10 border-[#39FF14]/40'
                      : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={extras.includes(opt.value)}
                      onChange={() => toggleExtra(opt.value)}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      extras.includes(opt.value)
                        ? 'bg-[#39FF14] border-[#39FF14]'
                        : 'border-gray-600'
                    }`}>
                      {extras.includes(opt.value) && <Check className="w-3 h-3 text-black" />}
                    </div>
                    <span className="text-sm text-gray-300">{opt.label}</span>
                  </div>
                  <span className="text-xs text-gray-500">{opt.price}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Customer Info (optional) */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <h2 className="text-sm font-medium text-white mb-3">Customer Info (optional)</h2>
            <div className="grid grid-cols-1 gap-3">
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                placeholder="Customer name"
              />
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                placeholder="Property address"
              />
            </div>
          </div>

          {/* Calculate Button */}
          <button
            onClick={handleCalculate}
            disabled={calculating || !roofArea || roofArea <= 0}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#39FF14] text-black font-bold text-lg rounded-xl hover:bg-[#32e612] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {calculating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Calculator className="w-5 h-5" />
            )}
            Calculate Estimate
          </button>
        </div>

        {/* ================================================================= */}
        {/* RIGHT: Results Display                                            */}
        {/* ================================================================= */}
        <div className="space-y-5">
          {!result ? (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
              <Calculator className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Enter roof details and click Calculate</p>
              <p className="text-gray-500 text-sm mt-1">Results will appear here</p>
            </div>
          ) : (
            <>
              {/* Total Estimate */}
              <div className="bg-gray-800/50 border border-[#39FF14]/30 rounded-xl p-6 text-center">
                <div className="text-gray-400 text-sm mb-1">Total Estimate</div>
                <div className="text-4xl font-bold text-[#39FF14]">
                  ${result.totalEstimate.toLocaleString()}
                </div>
                <div className="text-gray-400 text-sm mt-1">
                  Range: ${result.lowEstimate.toLocaleString()} — ${result.highEstimate.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  ${result.pricePerSquare.toLocaleString()}/square | {result.squares} squares
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#39FF14]" />
                  Cost Breakdown
                </h3>

                {/* Visual bar breakdown */}
                <div className="space-y-2 mb-4">
                  {breakdownItems.map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">{item.label}</span>
                        <span className="text-white font-medium">${item.value.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-900 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${breakdownTotal > 0 ? (item.value / breakdownTotal) * 100 : 0}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Extras detail */}
                {Object.keys(result.extrasCost).length > 0 && (
                  <div className="border-t border-gray-700/50 pt-3 mt-3">
                    <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Extras Detail</h4>
                    {Object.entries(result.extrasCost).map(([key, val]) => (
                      <div key={key} className="flex justify-between text-xs text-gray-400 py-0.5">
                        <span>{EXTRAS_LABELS[key] || key}</span>
                        <span className="text-gray-300">${val.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Line items */}
                <div className="border-t border-gray-700/50 pt-3 mt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Materials (incl. waste {result.wasteFactorPercent}%)</span>
                    <span className="text-white">${result.materialCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Labor</span>
                    <span className="text-white">${result.laborCost.toLocaleString()}</span>
                  </div>
                  {result.tearOffCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Tear-Off & Disposal</span>
                      <span className="text-white">${result.tearOffCost.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="text-white">${result.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Overhead (15%)</span>
                    <span className="text-gray-300">${result.overhead.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Profit (25%)</span>
                    <span className="text-gray-300">${result.profit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-700/50">
                    <span className="text-white">Total</span>
                    <span className="text-[#39FF14]">${result.totalEstimate.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Material Quantities */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#39FF14]" />
                  Material Quantities
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-900/50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-white">{result.squares}</div>
                    <div className="text-xs text-gray-500">Squares</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-white">{result.bundlesNeeded}</div>
                    <div className="text-xs text-gray-500">Bundles Needed</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-white">{result.underlaymentRolls}</div>
                    <div className="text-xs text-gray-500">Underlayment Rolls</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-white">{result.ridgeCapLinearFt} ft</div>
                    <div className="text-xs text-gray-500">Ridge Cap</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-white">{result.dripEdgeLinearFt} ft</div>
                    <div className="text-xs text-gray-500">Drip Edge</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-white">{result.starterStripLinearFt} ft</div>
                    <div className="text-xs text-gray-500">Starter Strip</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-white">{result.nailPounds} lbs</div>
                    <div className="text-xs text-gray-500">Nails</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-white">{result.wasteFactorPercent}%</div>
                    <div className="text-xs text-gray-500">Waste Factor</div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#39FF14]" />
                  Timeline
                </h3>
                <div className="flex gap-4">
                  <div className="bg-gray-900/50 p-3 rounded-lg flex-1 text-center">
                    <div className="text-2xl font-bold text-white">{result.estimatedDays}</div>
                    <div className="text-xs text-gray-500">Day{result.estimatedDays > 1 ? 's' : ''}</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg flex-1 text-center">
                    <div className="text-2xl font-bold text-white">{result.crewSize}</div>
                    <div className="text-xs text-gray-500">Crew Members</div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {result.notes.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                  <h3 className="text-sm font-medium text-white mb-3">Notes & Recommendations</h3>
                  <ul className="space-y-1">
                    {result.notes.map((note, i) => (
                      <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                        <span className="text-[#39FF14] mt-0.5">*</span>
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#32e612] disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Estimate
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>
            </>
          )}

          {/* Recent Estimates */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#39FF14]" />
              Recent Estimates
            </h3>
            {loadingRecent ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : recentEstimates.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No saved estimates yet</p>
            ) : (
              <div className="space-y-2">
                {recentEstimates.map(est => (
                  <button
                    key={est.id}
                    onClick={() => loadEstimate(est)}
                    className="w-full text-left p-3 bg-gray-900/50 border border-gray-700/50 rounded-lg hover:border-gray-600 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm text-white font-medium">
                          {est.customerName || 'Unnamed'} — {est.squares} sq
                        </div>
                        {est.address && (
                          <div className="text-xs text-gray-500 mt-0.5">{est.address}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#39FF14]">
                          ${est.totalEstimate.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(est.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
