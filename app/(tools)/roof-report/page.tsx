'use client';

import { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import RoofDiagram from '@/components/RoofDiagram';
import {
  Ruler, Building2, TriangleRight, Printer, ChevronDown, ChevronUp,
  CheckCircle2, Loader2, AlertTriangle, XCircle, Satellite, Eye,
  Camera, Upload, X, ImageIcon, Wrench, CircleDot, Wind, Flame,
  PenLine, FileText, Info, RotateCcw, Download, Share2, MapPin,
  Phone, Mail, Globe, Package, Shield, Layers
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface MeasurementGroup {
  totalFt: number;
  count: number;
  details: { lengthFt: number }[];
  confidence: string;
}

interface MeasurementsBlock {
  ridges: MeasurementGroup;
  rakes: MeasurementGroup;
  valleys: MeasurementGroup;
  eaves: MeasurementGroup;
  hips: MeasurementGroup;
  pitches: { primary: string; all: { pitch: string; segmentArea: number }[]; confidence: string };
  roofStyle: string;
  perimeterFt: number;
}

interface FlashingItem { type: string; length_ft: number; confidence: string }
interface TransitionItem { length_ft: number; description: string; confidence: string }
interface VentItem { type: string; count: number; confidence: string }
interface PipeItem { diameter_in: number; count: number; confidence: string }
interface ChimneyItem { width_ft: number; length_ft: number; flashing_perimeter_ft: number; confidence: string }
interface SkylightItem { width_ft: number; length_ft: number; flashing_perimeter_ft: number; confidence: string }

interface RoofComponents {
  flashing: FlashingItem[];
  transitions: TransitionItem[];
  vents: VentItem[];
  pipes: PipeItem[];
  chimneys: ChimneyItem[];
  skylights: SkylightItem[];
}

interface AIProviderResults {
  gemini: { status: string; measurements: Record<string, unknown> | null };
  geminiVerify: { status: string; measurements: Record<string, unknown> | null };
  ollama: { status: string; measurements: Record<string, unknown> | null };
}

interface RoofReport {
  address: string;
  lat: number;
  lng: number;
  generatedAt: string;
  imageryDate: string;
  solarData: {
    totalRoofAreaSqFt: number;
    groundFootprintSqFt: number;
    segmentCount: number;
    segments: { pitchDegrees: number; azimuthDegrees: number; areaSqFt: number; direction: string }[];
  };
  measurements: MeasurementsBlock;
  overallConfidence: string;
  aiResults: AIProviderResults;
  components: RoofComponents;
  satelliteMeasurements: MeasurementsBlock;
  satelliteConfidence: string;
  satelliteAiResults: AIProviderResults;
  satelliteComponents?: RoofComponents;
  enhancedMeasurements?: MeasurementsBlock;
  enhancedConfidence?: string;
  enhancedAiResults?: AIProviderResults;
  enhancedComponents?: RoofComponents;
  refinementNotes?: string;
  rerunPerformed: boolean;
  qualityNotes: string[];
  images: { satellite: string; satelliteZooms?: string[]; streetView: string[]; esriAerial?: string[]; bingAerial?: string[]; mapboxSatellite?: string[] };
  mode: 'satellite' | 'enhanced';
  photoCount: number;
  pipeline?: {
    phase: number;
    totalAiPasses: number;
    finalVariance: number;
    allProviderResults?: { name: string; totalRidge: number; totalRake: number; totalEave: number }[];
  };
  roofOutline?: {
    vertices: { id: string; x: number; y: number; label?: string }[];
    edges: { from: string; to: string; type: string; length_ft: number; label?: string }[];
    sections: { vertices: string[]; pitch: string; area_sqft: number; direction: string; label?: string }[];
  };
}

interface UploadedPhoto {
  id: string;
  file: File;
  preview: string;
  label: string;
}

interface ManualOverrides {
  ridges: string;
  rakes: string;
  valleys: string;
  eaves: string;
  hips: string;
  [key: string]: string;
}

const PHOTO_LABELS = ['Front', 'Back', 'Left Side', 'Right Side', 'Close-up 1', 'Close-up 2', 'Aerial/Drone', 'Other'];
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const POSITION_LABELS = [
  { label: 'Front', tip: 'Stand across the street, capture full front roofline' },
  { label: 'Front-Right Corner', tip: 'Include both front and right side in frame' },
  { label: 'Right Side', tip: 'Step back far enough to see the full roofline' },
  { label: 'Back-Right Corner', tip: 'Include both right and back side in frame' },
  { label: 'Back', tip: 'Capture full back roofline, hold phone level' },
  { label: 'Back-Left Corner', tip: 'Include both back and left side in frame' },
  { label: 'Left Side', tip: 'Step back far enough to see the full roofline' },
  { label: 'Front-Left Corner', tip: 'Include both left and front side in frame' },
];

// ── Helpers ────────────────────────────────────────────────────────────────

const confColor = (c: string) =>
  c === 'HIGH' ? 'text-emerald-400' : c === 'MEDIUM' ? 'text-blue-400' : c === 'LOW' ? 'text-amber-400' : c === 'MANUAL' ? 'text-purple-400' : 'text-zinc-500';

const confBg = (c: string) =>
  c === 'HIGH' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
    : c === 'MEDIUM' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
      : c === 'LOW' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        : c === 'MANUAL' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
          : 'bg-zinc-800 border-zinc-700 text-zinc-400';

const statusIcon = (s: string) =>
  s === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
    : s === 'skipped' ? <XCircle className="w-4 h-4 text-zinc-500" />
      : <AlertTriangle className="w-4 h-4 text-amber-400" />;

const ventLabel = (type: string) => {
  const labels: Record<string, string> = { pipe_boot: 'Pipe Boot', box: 'Box Vent', ridge: 'Ridge Vent', turbine: 'Turbine Vent', power: 'Power Vent' };
  return labels[type] || type;
};

const flashingLabel = (type: string) => {
  const labels: Record<string, string> = { wall: 'Wall Flashing', step: 'Step Flashing', counter: 'Counter Flashing' };
  return labels[type] || type;
};

// ── Material Estimates ─────────────────────────────────────────────────────

function calculateMaterials(report: RoofReport) {
  const totalSqFt = report.solarData.totalRoofAreaSqFt;
  const squares = totalSqFt / 100;
  const perimeterFt = report.measurements.perimeterFt;
  const ridgeFt = report.measurements.ridges.totalFt;
  const eavesFt = report.measurements.eaves.totalFt;
  const rakesFt = report.measurements.rakes.totalFt;
  const valleysFt = report.measurements.valleys.totalFt;
  const hipsFt = report.measurements.hips.totalFt;
  const wasteMultiplier = 1.15; // 15% waste factor

  return {
    shingles: {
      bundles: Math.ceil(squares * 3 * wasteMultiplier),
      squares: Math.ceil(squares * wasteMultiplier * 10) / 10,
      note: '3 bundles per square + 15% waste',
    },
    underlayment: {
      rolls: Math.ceil(totalSqFt / 400 * wasteMultiplier), // 4 sq per roll (synthetic)
      note: 'Synthetic underlayment, 4 sq/roll',
    },
    ridgeCap: {
      linearFt: Math.ceil(ridgeFt + hipsFt),
      bundles: Math.ceil((ridgeFt + hipsFt) / 25), // ~25 lf per bundle
      note: 'Ridge + hip cap shingles',
    },
    starterStrip: {
      linearFt: Math.ceil(eavesFt + rakesFt),
      bundles: Math.ceil((eavesFt + rakesFt) / 105), // ~105 lf per bundle
      note: 'Starter strip along eaves & rakes',
    },
    dripEdge: {
      linearFt: Math.ceil(eavesFt + rakesFt),
      pieces: Math.ceil((eavesFt + rakesFt) / 10), // 10ft pieces
      note: '10ft sections for eaves & rakes',
    },
    iceWaterShield: {
      linearFt: Math.ceil(eavesFt + valleysFt * 2),
      rolls: Math.ceil((eavesFt * 3 + valleysFt * 6) / 65), // 65 sqft per roll, 3ft at eaves, 6ft in valleys
      note: 'Eaves (3ft up) + valleys (3ft each side)',
    },
    valleyMetal: {
      linearFt: Math.ceil(valleysFt),
      pieces: Math.ceil(valleysFt / 10),
      note: 'W-style valley metal, 10ft sections',
    },
    nails: {
      boxes: Math.ceil(squares * wasteMultiplier / 25), // ~25 squares per box
      note: '1¼" coil nails, ~25 squares per box',
    },
    ventilation: {
      ridgeVentFt: Math.ceil(ridgeFt * 0.8),
      note: 'Ridge vent for ~80% of ridge length',
    },
    pipeBoots: {
      count: report.components.pipes.reduce((s, p) => s + p.count, 0) || 0,
      note: 'Replacement pipe boot flashings',
    },
  };
}

// ── Progress Steps ─────────────────────────────────────────────────────────

function ProgressSteps({ step, hasPhotos }: { step: number; hasPhotos: boolean }) {
  const steps = [
    { icon: '📡', text: 'Hacking into Sputnik... just kidding. Connecting to satellite services...' },
    { icon: '🛰️', text: 'Borrowing Putin\'s spy satellites for a better view...' },
    { icon: '🇮🇳', text: 'India\'s got eyes on your roof now too...' },
    { icon: '🇨🇳', text: 'China\'s lunar rover is zooming in from the dark side of the moon...' },
    { icon: '📠', text: 'Zimbabwe just sent a telegraph — they see it too...' },
    { icon: '🏛️', text: 'The Pentagon has classified your roof as "interesting"...' },
    { icon: '✈️', text: 'Redirecting an F-35 flyover for thermal imaging...' },
    { icon: '🤖', text: 'AI analysis pass 1 — measuring roof geometry...' },
    { icon: '🔍', text: 'AI verification pass — cross-checking measurements...' },
    { icon: '🦙', text: 'Local AI backup — the llama is doing math...' },
    { icon: '📊', text: 'Building consensus from multiple AI models...' },
    ...(hasPhotos ? [
      { icon: '📸', text: 'Processing your on-site photos...' },
      { icon: '🔬', text: 'Photo-enhanced AI analysis — CSI: Roofing Edition...' },
      { icon: '📐', text: 'Refining measurements with photo data...' },
      { icon: '✅', text: 'Finalizing enhanced report...' },
    ] : []),
  ];

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-white/5 backdrop-blur border border-white/10 rounded-full">
          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
          <span className="text-sm text-zinc-300">Analyzing roof — typically 1-2 minutes</span>
        </div>
      </div>
      <div className="space-y-2.5">
        {steps.map((s, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-500 ${
            i < step ? 'bg-emerald-500/5' : i === step ? 'bg-white/5' : 'opacity-30'
          }`}>
            {i < step ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              : i === step ? <Loader2 className="w-5 h-5 text-emerald-400 animate-spin shrink-0" />
                : <div className="w-5 h-5 rounded-full border border-zinc-700 shrink-0" />}
            <span className={`text-sm ${i <= step ? 'text-zinc-200' : 'text-zinc-600'}`}>
              {s.icon} {s.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Photo Upload Component ─────────────────────────────────────────────────

function PhotoUpload({
  photos, onAdd, onRemove, onLabelChange,
}: {
  photos: UploadedPhoto[];
  onAdd: (files: FileList) => void;
  onRemove: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">Upload property photos to enhance accuracy. Recommended: 4 corners + any complex areas.</p>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) onAdd(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-emerald-400 bg-emerald-400/5' : 'border-zinc-700 hover:border-zinc-500'
        } ${photos.length >= 8 ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <Upload className="w-8 h-8 mx-auto mb-3 text-zinc-500" />
        <p className="text-sm text-zinc-300">Drag & drop photos or click to browse</p>
        <p className="text-xs text-zinc-500 mt-1">JPG, PNG, WebP · Max 10MB each · Up to 8 photos</p>
        <input ref={fileRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.heic" className="hidden"
          onChange={e => e.target.files && onAdd(e.target.files)} />
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {photos.map(photo => (
            <div key={photo.id} className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
              <div className="relative aspect-[4/3]">
                <Image src={photo.preview} alt={photo.label} fill className="object-cover" unoptimized />
                <button onClick={(e) => { e.stopPropagation(); onRemove(photo.id); }}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="p-2">
                <select value={photo.label} onChange={e => onLabelChange(photo.id, e.target.value)}
                  className="w-full text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white">
                  {PHOTO_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Material Estimates Table ───────────────────────────────────────────────

function MaterialEstimates({ report }: { report: RoofReport }) {
  const m = calculateMaterials(report);

  const rows = [
    { category: 'Shingles', item: 'Architectural Shingles', qty: `${m.shingles.bundles} bundles (${m.shingles.squares} sq)`, note: m.shingles.note, icon: Layers },
    { category: 'Underlayment', item: 'Synthetic Underlayment', qty: `${m.underlayment.rolls} rolls`, note: m.underlayment.note, icon: Shield },
    { category: 'Ridge Cap', item: 'Ridge/Hip Cap Shingles', qty: `${m.ridgeCap.bundles} bundles (${m.ridgeCap.linearFt} lf)`, note: m.ridgeCap.note, icon: TriangleRight },
    { category: 'Starter', item: 'Starter Strip', qty: `${m.starterStrip.bundles} bundles (${m.starterStrip.linearFt} lf)`, note: m.starterStrip.note, icon: Ruler },
    { category: 'Drip Edge', item: 'Drip Edge', qty: `${m.dripEdge.pieces} pcs (${m.dripEdge.linearFt} lf)`, note: m.dripEdge.note, icon: Ruler },
    { category: 'Ice & Water', item: 'Ice & Water Shield', qty: `${m.iceWaterShield.rolls} rolls`, note: m.iceWaterShield.note, icon: Shield },
    ...(m.valleyMetal.linearFt > 0 ? [{ category: 'Valley', item: 'Valley Metal', qty: `${m.valleyMetal.pieces} pcs (${m.valleyMetal.linearFt} lf)`, note: m.valleyMetal.note, icon: Ruler }] : []),
    { category: 'Nails', item: 'Coil Nails', qty: `${m.nails.boxes} boxes`, note: m.nails.note, icon: Package },
    { category: 'Ventilation', item: 'Ridge Vent', qty: `${m.ventilation.ridgeVentFt} lf`, note: m.ventilation.note, icon: Wind },
    ...(m.pipeBoots.count > 0 ? [{ category: 'Flashing', item: 'Pipe Boots', qty: `${m.pipeBoots.count} pcs`, note: m.pipeBoots.note, icon: CircleDot }] : []),
  ];

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-white/[0.06]">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Package className="w-5 h-5 text-emerald-400" />
          Material Estimates
        </h3>
        <p className="text-sm text-zinc-500 mt-1">Based on measured roof dimensions · Includes 15% waste factor</p>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {rows.map((row, i) => (
          <div key={i} className="px-6 py-3.5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
            <row.icon className="w-4 h-4 text-zinc-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-zinc-200">{row.item}</div>
              <div className="text-xs text-zinc-500">{row.note}</div>
            </div>
            <div className="text-sm font-mono font-medium text-white whitespace-nowrap">{row.qty}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Components Display ─────────────────────────────────────────────────────

function ComponentsSection({ components }: { components: RoofComponents }) {
  const hasData = components.chimneys.length > 0 || components.skylights.length > 0 ||
    components.vents.length > 0 || components.pipes.length > 0 ||
    components.flashing.length > 0 || components.transitions.length > 0;

  if (!hasData) return null;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-white/[0.06]">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Wrench className="w-5 h-5 text-emerald-400" />
          Roof Components & Penetrations
        </h3>
      </div>
      <div className="p-6 space-y-5">
        {components.chimneys.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2"><Flame className="w-4 h-4 text-orange-400" /> Chimneys</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {components.chimneys.map((ch, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Chimney {i + 1}</span>
                    <span className={`px-2 py-0.5 rounded text-xs border ${confBg(ch.confidence)}`}>{ch.confidence}</span>
                  </div>
                  <p className="text-xs text-zinc-400">{ch.width_ft}ft × {ch.length_ft}ft · Flashing: {ch.flashing_perimeter_ft} lf</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {components.skylights.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2"><Eye className="w-4 h-4 text-blue-400" /> Skylights</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {components.skylights.map((sk, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Skylight {i + 1}</span>
                    <span className={`px-2 py-0.5 rounded text-xs border ${confBg(sk.confidence)}`}>{sk.confidence}</span>
                  </div>
                  <p className="text-xs text-zinc-400">{sk.width_ft}ft × {sk.length_ft}ft · Flashing: {sk.flashing_perimeter_ft} lf</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {components.vents.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2"><Wind className="w-4 h-4 text-cyan-400" /> Ventilation</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {components.vents.map((v, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold">{v.count}</div>
                  <div className="text-xs text-zinc-400 mt-1">{ventLabel(v.type)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {components.pipes.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2"><CircleDot className="w-4 h-4" /> Pipe Penetrations</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {components.pipes.map((p, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold">{p.count}</div>
                  <div className="text-xs text-zinc-400 mt-1">{p.diameter_in}&quot; diameter</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {components.flashing.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2"><Ruler className="w-4 h-4 text-yellow-400" /> Flashing</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {components.flashing.map((f, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between">
                  <span className="text-sm">{flashingLabel(f.type)}</span>
                  <span className="text-sm font-mono font-medium">{f.length_ft} lf</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── On-Site Enhancement Section ────────────────────────────────────────────

function OnSiteEnhancement({
  report, onRerun, manualOverrides, setManualOverrides, manualNotes, setManualNotes,
}: {
  report: RoofReport;
  onRerun: (photos: UploadedPhoto[]) => void;
  manualOverrides: ManualOverrides;
  setManualOverrides: (o: ManualOverrides) => void;
  manualNotes: string;
  setManualNotes: (n: string) => void;
}) {
  const [sectionOpen, setSectionOpen] = useState(false);
  const [onsitePhotos, setOnsitePhotos] = useState<UploadedPhoto[]>([]);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleFileForPosition = (idx: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > MAX_FILE_SIZE) return;
    const newPhoto: UploadedPhoto = {
      id: `onsite-${idx}-${Date.now()}`, file, preview: URL.createObjectURL(file), label: POSITION_LABELS[idx].label,
    };
    setOnsitePhotos(prev => [...prev.filter(p => !p.id.startsWith(`onsite-${idx}-`)), newPhoto]);
  };

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden no-print">
      <button onClick={() => setSectionOpen(!sectionOpen)}
        className="w-full px-6 py-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Camera className="w-5 h-5 text-emerald-400" />
          On-Site Enhancement
        </h3>
        {sectionOpen ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
      </button>

      {sectionOpen && (
        <div className="px-6 pb-6 space-y-6 border-t border-white/[0.04]">
          {/* Position-Based Photo Upload */}
          <div className="pt-4">
            <h4 className="text-sm font-medium text-zinc-300 mb-3">Upload Photos by Position</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {POSITION_LABELS.map((pos, idx) => {
                const photo = onsitePhotos.find(p => p.id.startsWith(`onsite-${idx}-`));
                return (
                  <div key={idx} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
                    {photo ? (
                      <div className="relative aspect-[4/3]">
                        <Image src={photo.preview} alt={pos.label} fill className="object-cover" unoptimized />
                        <button onClick={() => setOnsitePhotos(prev => prev.filter(p => p.id !== photo.id))}
                          className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center hover:bg-red-600">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div onClick={() => fileRefs.current[idx]?.click()}
                        className="aspect-[4/3] flex flex-col items-center justify-center cursor-pointer hover:bg-white/[0.03] transition-colors">
                        <Camera className="w-5 h-5 text-zinc-600 mb-1" />
                        <span className="text-xs text-zinc-600">Add</span>
                      </div>
                    )}
                    <div className="p-2 text-center"><p className="text-xs font-medium text-zinc-400">{pos.label}</p></div>
                    <input ref={el => { fileRefs.current[idx] = el; }} type="file" accept=".jpg,.jpeg,.png,.webp,.heic" className="hidden"
                      onChange={e => handleFileForPosition(idx, e.target.files)} />
                  </div>
                );
              })}
            </div>
            {onsitePhotos.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Button onClick={() => onRerun(onsitePhotos)}
                  className="bg-emerald-500 text-white font-semibold hover:bg-emerald-600">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Re-analyze with {onsitePhotos.length} Photo{onsitePhotos.length !== 1 ? 's' : ''}
                </Button>
              </div>
            )}
          </div>

          {/* Manual Overrides */}
          <div>
            <h4 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
              <PenLine className="w-4 h-4" /> Manual Measurement Override
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {(['ridges', 'rakes', 'valleys', 'eaves', 'hips'] as const).map(key => (
                <div key={key}>
                  <label className="text-xs text-zinc-500 capitalize block mb-1">{key}</label>
                  <div className="flex items-center gap-1">
                    <input type="number" value={manualOverrides[key]}
                      onChange={e => setManualOverrides({ ...manualOverrides, [key]: e.target.value })}
                      placeholder={report.measurements[key].totalFt.toFixed(0)}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50" />
                    <span className="text-xs text-zinc-500">ft</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <h4 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Notes</h4>
            <textarea value={manualNotes} onChange={e => setManualNotes(e.target.value)}
              placeholder="Additional notes about roof condition, visible damage, etc."
              rows={3} className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 resize-y" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── PDF Download ───────────────────────────────────────────────────────────

async function downloadPDF() {
  // Use browser print as PDF
  window.print();
}

// ── Share Link ─────────────────────────────────────────────────────────────

// ── Multi-Source Imagery Viewer ─────────────────────────────────────────────

const SAT_LABELS = ['Zoom 20 (Primary)', 'Zoom 21 (Max Detail)', 'Zoom 19 (Context)', 'Offset North', 'Offset East', 'Offset South', 'Offset West', 'Hybrid Overlay'];
const SV_LABELS = ['North', 'East', 'South', 'West', 'Northeast', 'Southeast', 'Southwest', 'Northwest', 'North (Steep)', 'South (Steep)'];

function ImageryViewer({ report: r }: { report: RoofReport }) {
  const [activeTab, setActiveTab] = useState<'satellite' | 'street' | 'esri' | 'bing' | 'mapbox'>('satellite');
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);

  const satImages = (r.images.satelliteZooms || (r.images.satellite ? [r.images.satellite] : []));
  const svImages = r.images.streetView || [];
  const esriImages = r.images.esriAerial || [];
  const bingImages = r.images.bingAerial || [];
  const mapboxImages = r.images.mapboxSatellite || [];

  const tabs: { key: typeof activeTab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'satellite', label: 'Google Satellite', icon: <Satellite className="w-3.5 h-3.5" />, count: satImages.length },
    { key: 'street', label: 'Street View', icon: <Eye className="w-3.5 h-3.5" />, count: svImages.length },
  ];
  if (esriImages.length > 0) tabs.push({ key: 'esri', label: 'Esri/ArcGIS', icon: <Globe className="w-3.5 h-3.5" />, count: esriImages.length });
  if (bingImages.length > 0) tabs.push({ key: 'bing', label: 'Bing Aerial', icon: <Globe className="w-3.5 h-3.5" />, count: bingImages.length });
  if (mapboxImages.length > 0) tabs.push({ key: 'mapbox', label: 'Mapbox', icon: <Globe className="w-3.5 h-3.5" />, count: mapboxImages.length });

  const getActiveImages = (): { src: string; label: string }[] => {
    switch (activeTab) {
      case 'satellite': return satImages.map((img, i) => ({ src: img.startsWith('data:') ? img : `data:image/png;base64,${img}`, label: SAT_LABELS[i] || `Satellite ${i + 1}` }));
      case 'street': return svImages.map((img, i) => ({ src: img.startsWith('data:') ? img : `data:image/png;base64,${img}`, label: SV_LABELS[i] || `View ${i + 1}` }));
      case 'esri': return esriImages.map((img, i) => ({ src: img.startsWith('data:') ? img : `data:image/png;base64,${img}`, label: `Esri Aerial ${i + 1}` }));
      case 'bing': return bingImages.map((img, i) => ({ src: img.startsWith('data:') ? img : `data:image/png;base64,${img}`, label: `Bing Aerial ${i + 1}` }));
      case 'mapbox': return mapboxImages.map((img, i) => ({ src: img.startsWith('data:') ? img : `data:image/png;base64,${img}`, label: `Mapbox ${i + 1}` }));
      default: return [];
    }
  };

  const images = getActiveImages();

  return (
    <>
      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/70 hover:text-white z-50">
            <X className="w-8 h-8" />
          </button>
          <div className="max-w-4xl max-h-[90vh] relative" onClick={e => e.stopPropagation()}>
            <img src={lightbox.src} alt={lightbox.label} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <div className="text-center mt-3 text-sm text-zinc-400">{lightbox.label}</div>
          </div>
        </div>
      )}

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 pt-4 pb-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              {tab.icon} {tab.label}
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${
                activeTab === tab.key ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.05] text-zinc-600'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Image grid */}
        <div className="p-4 pt-2">
          {images.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-sm">No imagery available for this source</div>
          ) : (
            <div className={`grid gap-3 ${images.length <= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5'}`}>
              {images.map((img, i) => (
                <div
                  key={i}
                  onClick={() => setLightbox(img)}
                  className="relative aspect-square rounded-xl overflow-hidden border border-white/[0.06] cursor-pointer hover:border-emerald-500/30 transition-colors group"
                >
                  <Image src={img.src} alt={img.label} fill className="object-cover group-hover:scale-105 transition-transform duration-300" unoptimized />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <span className="text-xs text-white/80">{img.label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Source count summary */}
        <div className="px-4 pb-3 flex items-center gap-3 text-[10px] text-zinc-600">
          <span>{satImages.length} satellite</span>
          <span>·</span>
          <span>{svImages.length} street view</span>
          {esriImages.length > 0 && <><span>·</span><span>{esriImages.length} Esri</span></>}
          {bingImages.length > 0 && <><span>·</span><span>{bingImages.length} Bing</span></>}
          {mapboxImages.length > 0 && <><span>·</span><span>{mapboxImages.length} Mapbox</span></>}
          <span>·</span>
          <span className="text-emerald-500/60">{satImages.length + svImages.length + esriImages.length + bingImages.length + mapboxImages.length} total views</span>
        </div>
      </div>
    </>
  );
}

function ShareButton({ report }: { report: RoofReport }) {
  const [shared, setShared] = useState(false);
  const [homeownerMode, setHomeownerMode] = useState(false);

  const handleShare = async () => {
    const shareData = {
      title: `Roof Report — ${report.address}`,
      text: `Roof measurement report for ${report.address}. Total area: ${report.solarData.totalRoofAreaSqFt.toLocaleString()} sq ft (${(report.solarData.totalRoofAreaSqFt / 100).toFixed(1)} squares). ${report.measurements.pitches.primary} pitch.`,
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handleShare} variant="outline" size="sm"
        className="border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white">
        {shared ? <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" /> : <Share2 className="w-4 h-4 mr-2" />}
        {shared ? 'Copied!' : 'Share'}
      </Button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function RoofReportPage() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [report, setReport] = useState<RoofReport | null>(null);
  const [error, setError] = useState('');
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [photosOpen, setPhotosOpen] = useState(false);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [manualOverrides, setManualOverrides] = useState<ManualOverrides>({ ridges: '', rakes: '', valleys: '', eaves: '', hips: '' });
  const [manualNotes, setManualNotes] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Load Google Maps + autocomplete biased to Decatur/Hartselle AL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let interval: ReturnType<typeof setInterval> | null = null;

    const setup = () => {
      if (!window.google?.maps?.places || !inputRef.current || autocompleteRef.current) return false;
      const bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(34.35, -87.15),
        new google.maps.LatLng(34.75, -86.75),
      );
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
        bounds,
      });
      autocompleteRef.current.setBounds(bounds);
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (place?.formatted_address) setAddress(place.formatted_address);
      });
      return true;
    };

    if (!window.google?.maps?.places && !document.querySelector('script[src*="maps.googleapis.com"]')) {
      const script = document.createElement('script');
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      document.head.appendChild(script);
    }

    if (!setup()) {
      interval = setInterval(() => { if (setup() && interval) clearInterval(interval); }, 500);
    }
    return () => { if (interval) clearInterval(interval); };
  }, []);

  const addPhotos = useCallback((files: FileList) => {
    const newPhotos: UploadedPhoto[] = [];
    const currentCount = photos.length;
    for (let i = 0; i < files.length && currentCount + newPhotos.length < 8; i++) {
      const file = files[i];
      if (!ACCEPTED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.heic')) continue;
      if (file.size > MAX_FILE_SIZE) continue;
      const labelIdx = currentCount + newPhotos.length;
      newPhotos.push({ id: `${Date.now()}-${i}`, file, preview: URL.createObjectURL(file), label: PHOTO_LABELS[labelIdx] || 'Other' });
    }
    setPhotos(prev => [...prev, ...newPhotos]);
  }, [photos.length]);

  const removePhoto = useCallback((id: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id);
      if (photo) URL.revokeObjectURL(photo.preview);
      return prev.filter(p => p.id !== id);
    });
  }, []);

  const updatePhotoLabel = useCallback((id: string, label: string) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, label } : p));
  }, []);

  const analyze = useCallback(async () => {
    if (!address.trim()) return;
    setLoading(true); setError(''); setReport(null); setStep(0);
    const hasPhotos = photos.length > 0;
    const totalSteps = hasPhotos ? 11 : 7;
    const interval = setInterval(() => setStep(s => Math.min(s + 1, totalSteps - 1)), 3500);
    try {
      let res: Response;
      if (hasPhotos) {
        const formData = new FormData();
        formData.append('address', address);
        formData.append('mode', 'enhanced');
        formData.append('photoLabels', JSON.stringify(photos.map(p => p.label)));
        for (const photo of photos) formData.append('photos', photo.file);
        res = await fetch('/api/roof-measure', { method: 'POST', body: formData });
      } else {
        res = await fetch(`/api/roof-measure?address=${encodeURIComponent(address)}`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setReport(data); setStep(totalSteps);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { clearInterval(interval); setLoading(false); }
  }, [address, photos]);

  const handleOnsiteRerun = useCallback(async (onsitePhotos: UploadedPhoto[]) => {
    if (!address.trim() || onsitePhotos.length === 0) return;
    setLoading(true); setError(''); setStep(0);
    const totalSteps = 11;
    const interval = setInterval(() => setStep(s => Math.min(s + 1, totalSteps - 1)), 3500);
    try {
      const formData = new FormData();
      formData.append('address', address);
      formData.append('mode', 'enhanced');
      formData.append('photoLabels', JSON.stringify(onsitePhotos.map(p => p.label)));
      for (const photo of onsitePhotos) formData.append('photos', photo.file);
      const res = await fetch('/api/roof-measure', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setReport(data); setStep(totalSteps);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { clearInterval(interval); setLoading(false); }
  }, [address]);

  const toggleRow = (key: string) => setExpandedRows(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });

  const getDisplayValue = (key: string, original: number) => {
    const override = manualOverrides[key];
    if (override && !isNaN(parseFloat(override))) return { value: parseFloat(override), isManual: true };
    return { value: original, isManual: false };
  };

  const r = report;

  return (
    <>
      <style jsx global>{`
        @media print {
          /* ── Base Reset ── */
          *, *::before, *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          html, body { background: white !important; color: #1a1a1a !important; font-size: 11pt !important; line-height: 1.4 !important; }
          
          /* ── Hide interactive elements ── */
          .no-print, header.no-print, button, input, select, textarea { display: none !important; }
          
          /* ── Show print-only sections ── */
          .print-only { display: block !important; }
          
          /* ── Page breaks ── */
          .print-break { page-break-before: always; }
          .report-card, table, .print-section { page-break-inside: avoid; }
          
          /* ── Main container ── */
          .min-h-screen { min-height: auto !important; background: white !important; }
          main { padding: 0 !important; max-width: 100% !important; }
          
          /* ── Cards — clean borders on white ── */
          .report-card, [class*="bg-white/"], [class*="border-white/"] {
            background: white !important;
            border: 1.5px solid #d1d5db !important;
            border-radius: 8px !important;
            box-shadow: none !important;
            margin-bottom: 12pt !important;
          }
          
          /* ── Typography — dark on white ── */
          h1, h2, h3, h4, h5, h6 { color: #111827 !important; }
          p, span, td, th, li, div { color: #374151 !important; }
          .text-white, [class*="text-zinc-"], [class*="text-emerald-"], [class*="text-blue-"] { color: #374151 !important; }
          h1 span, h2 span { color: #111827 !important; background: none !important; -webkit-text-fill-color: #111827 !important; }
          
          /* ── Key metrics boxes ── */
          .grid > [class*="text-center"] {
            border: 1.5px solid #d1d5db !important;
            background: #f9fafb !important;
            padding: 10pt !important;
          }
          .grid > [class*="text-center"] .text-2xl { color: #111827 !important; font-weight: 700 !important; font-size: 16pt !important; }
          .grid > [class*="text-center"] svg { color: #059669 !important; }
          
          /* ── Confidence badges ── */
          [class*="bg-emerald-500"], [class*="border-emerald-"] { background: #d1fae5 !important; border-color: #059669 !important; color: #065f46 !important; }
          [class*="bg-blue-500"], [class*="border-blue-"] { background: #dbeafe !important; border-color: #2563eb !important; color: #1e40af !important; }
          [class*="bg-amber-500"], [class*="border-amber-"] { background: #fef3c7 !important; border-color: #d97706 !important; color: #92400e !important; }
          
          /* ── Tables ── */
          table { width: 100% !important; border-collapse: collapse !important; }
          th { background: #f3f4f6 !important; color: #374151 !important; font-weight: 600 !important; border-bottom: 2px solid #d1d5db !important; padding: 6pt 8pt !important; font-size: 9pt !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; }
          td { border-bottom: 1px solid #e5e7eb !important; padding: 6pt 8pt !important; font-size: 10pt !important; }
          tr:hover { background: transparent !important; }
          .font-mono { font-family: 'Courier New', monospace !important; font-weight: 600 !important; color: #111827 !important; }
          
          /* ── Images — satellite & street view ── */
          .grid img, [class*="aspect-square"] img { border: 1px solid #d1d5db !important; border-radius: 4px !important; }
          [class*="aspect-square"] { break-inside: avoid !important; }
          [class*="from-black"] { background: rgba(0,0,0,0.6) !important; }
          [class*="from-black"] span { color: white !important; }
          
          /* ── Section headers ── */
          [class*="border-b"] > h3 { font-size: 13pt !important; color: #111827 !important; padding: 8pt 0 !important; }
          [class*="border-b"] > h3 svg { color: #059669 !important; }
          
          /* ── Material estimates rows ── */
          [class*="divide-y"] > div { padding: 5pt 12pt !important; }
          [class*="divide-y"] > div svg { color: #6b7280 !important; }
          
          /* ── Components section ── */
          [class*="bg-white/[0.03]"] { background: #f9fafb !important; border: 1px solid #e5e7eb !important; }
          
          /* ── Footer ── */
          footer { margin-top: 20pt !important; padding-top: 12pt !important; border-top: 2px solid #059669 !important; }
          footer p, footer span { color: #6b7280 !important; font-size: 8pt !important; }
          footer img { opacity: 1 !important; }
          
          /* ── Pitch segments grid ── */
          .grid [class*="rounded-xl"] { background: #f9fafb !important; border: 1px solid #e5e7eb !important; }
          .grid [class*="rounded-xl"] .text-lg { color: #111827 !important; font-size: 13pt !important; }
          
          /* ── Property info card address ── */
          .text-xl { font-size: 14pt !important; color: #111827 !important; }
          
          /* ── Gradient text fix ── */
          [class*="bg-gradient-to-r"] { background: none !important; -webkit-text-fill-color: #111827 !important; }
          [class*="bg-clip-text"] { -webkit-background-clip: unset !important; background-clip: unset !important; }
          
          /* ── Lucide icons in print ── */
          svg { width: 14px !important; height: 14px !important; }
          svg.w-5 { width: 16px !important; height: 16px !important; }
        }
        
        @page {
          margin: 0.6in 0.5in;
          size: letter;
        }
        
        @page :first {
          margin-top: 0.3in;
        }
      `}</style>

      <div className="min-h-screen bg-[#0a0a0f] text-white">
        {/* ══════════ HEADER — Always visible ══════════ */}
        <header className="no-print border-b border-white/[0.06] bg-gradient-to-b from-[#0f1015] to-[#0a0a0f]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <div className="text-center">
              {/* Logo */}
              <div className="inline-flex items-center justify-center mb-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full" />
                  <Image src="/logo-transparent.png" alt="River City Roofing Solutions" width={64} height={64} className="relative rounded-xl" />
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                  Roof Measurement Report
                </span>
              </h1>
              <p className="text-zinc-500 text-sm mt-2 tracking-wide">
                RIVER CITY ROOFING SOLUTIONS · AI-POWERED ANALYSIS
              </p>

              {/* Photo upload toggle */}
              <div className="mt-6 max-w-2xl mx-auto text-left">
                <button onClick={() => setPhotosOpen(!photosOpen)}
                  className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-2 w-full">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Upload Property Photos</span>
                  <span className="text-xs text-zinc-600">(optional — improves accuracy)</span>
                  {photos.length > 0 && (
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-full ml-1">{photos.length}</span>
                  )}
                  <span className="ml-auto">{photosOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
                </button>
                {photosOpen && (
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 mb-4">
                    <PhotoUpload photos={photos} onAdd={addPhotos} onRemove={removePhoto} onLabelChange={updatePhotoLabel} />
                  </div>
                )}
              </div>

              {/* Search bar */}
              <div className="mt-4 max-w-xl mx-auto">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      ref={inputRef} type="text" value={address}
                      onChange={e => setAddress(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && analyze()}
                      placeholder="Enter property address..."
                      className="w-full pl-10 pr-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/40 focus:bg-white/[0.06] transition-all"
                    />
                  </div>
                  <Button onClick={analyze} disabled={loading || !address.trim()}
                    className="px-6 py-3.5 bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-40 rounded-xl transition-colors">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Analyze'}
                  </Button>
                </div>
                <p className="text-xs text-zinc-600 mt-2 text-center">
                  Optimized for Decatur, Hartselle & North Alabama service area
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* ══════════ BODY ══════════ */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {loading && <ProgressSteps step={step} hasPhotos={photos.length > 0} />}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 text-center">
              <AlertTriangle className="w-5 h-5 inline mr-2 text-red-400" />
              <span className="text-red-300">{error}</span>
            </div>
          )}

          {r && (
            <div className="space-y-6">

              {/* ── Print Header — EagleView-style professional banner ── */}
              <div className="print-only hidden mb-6">
                <div style={{ background: '#059669', padding: '16pt 20pt', borderRadius: '8px', marginBottom: '12pt', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12pt' }}>
                    <Image src="/logo-transparent.png" alt="RCRS" width={48} height={48} style={{ borderRadius: '6px', background: 'white', padding: '4px' }} />
                    <div>
                      <h1 style={{ fontSize: '18pt', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.5px' }}>ROOF MEASUREMENT REPORT</h1>
                      <p style={{ fontSize: '8pt', color: 'rgba(255,255,255,0.85)', margin: '2pt 0 0 0', letterSpacing: '1px', textTransform: 'uppercase' }}>River City Roofing Solutions · AI-Powered Satellite Analysis</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '8.5pt', color: 'white', lineHeight: '1.6' }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>(256) 274-8530</p>
                    <p style={{ margin: 0 }}>rivercityroofingsolutions.com</p>
                    <p style={{ margin: 0 }}>info@rcrsal.com</p>
                  </div>
                </div>
              </div>

              {/* ── Property Info Card ── */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 report-card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                      <h2 className="text-xl font-semibold">{r.address}</h2>
                    </div>
                    <p className="text-sm text-zinc-500 ml-6">
                      Report generated {new Date(r.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      {' · '}Imagery date: {r.imageryDate}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3 ml-6">
                      <span className="px-2.5 py-1 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs capitalize">{r.measurements.roofStyle} Roof</span>
                      <span className="px-2.5 py-1 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs">{r.solarData.segmentCount} Segments</span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs border ${confBg(r.overallConfidence)}`}>
                        {r.overallConfidence} Confidence
                      </span>
                      {r.mode === 'enhanced' && (
                        <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg text-xs">
                          Photo-Enhanced
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="no-print flex items-center gap-2">
                    <ShareButton report={r} />
                    <Button onClick={downloadPDF} variant="outline" size="sm"
                      className="border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white">
                      <Download className="w-4 h-4 mr-2" /> PDF
                    </Button>
                    <Button onClick={() => window.print()} variant="outline" size="sm"
                      className="border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white">
                      <Printer className="w-4 h-4 mr-2" /> Print
                    </Button>
                  </div>
                </div>
              </div>

              {/* ── Multi-Source Imagery Viewer ── */}
              <ImageryViewer report={r} />

              {/* ── Interactive Roof Diagram ── */}
              <RoofDiagram
                outline={r.roofOutline || null}
                buildingWidth={r.solarData.groundFootprintSqFt ? Math.sqrt(r.solarData.groundFootprintSqFt) : 40}
                buildingLength={r.solarData.groundFootprintSqFt ? Math.sqrt(r.solarData.groundFootprintSqFt) * 1.2 : 50}
                roofStyle={r.measurements.roofStyle}
                totalArea={r.solarData.totalRoofAreaSqFt}
                interactive={true}
              />

              {/* ── Key Metrics ── */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Total Roof Area', value: r.solarData.totalRoofAreaSqFt.toLocaleString(), unit: 'sq ft', icon: Building2 },
                  { label: 'Roofing Squares', value: (r.solarData.totalRoofAreaSqFt / 100).toFixed(1), unit: 'squares', icon: Layers },
                  { label: 'Primary Pitch', value: r.measurements.pitches.primary, unit: '', icon: TriangleRight },
                  { label: 'Total Perimeter', value: r.measurements.perimeterFt.toLocaleString(), unit: 'lin ft', icon: Ruler },
                  { label: 'Confidence', value: r.overallConfidence, unit: '', icon: Shield, color: confColor(r.overallConfidence) },
                  ...(r.pipeline ? [{ label: 'AI Passes', value: `${r.pipeline.totalAiPasses}`, unit: `Phase ${r.pipeline.phase} · ${(r.pipeline.finalVariance * 100).toFixed(0)}% var`, icon: Layers, color: r.pipeline.finalVariance <= 0.10 ? 'text-emerald-400' : r.pipeline.finalVariance <= 0.20 ? 'text-amber-400' : 'text-red-400' }] : []),
                ].map((m, i) => (
                  <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 text-center report-card">
                    <m.icon className={`w-5 h-5 mx-auto mb-2 ${m.color || 'text-emerald-400'}`} />
                    <div className={`text-2xl font-bold ${m.color || 'text-white'}`}>{m.value}</div>
                    {m.unit && <div className="text-xs text-zinc-500 mt-0.5">{m.unit}</div>}
                    <div className="text-xs text-zinc-600 mt-1">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* ── Linear Measurements Table ── */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden report-card">
                <div className="px-6 py-5 border-b border-white/[0.06]">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Ruler className="w-5 h-5 text-emerald-400" />
                    Roof Measurements
                  </h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    Linear measurements from AI consensus
                    {r.mode === 'enhanced' && ' (photo-enhanced)'}
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-zinc-500">
                      <th className="text-left px-6 py-3 font-medium">Measurement</th>
                      <th className="text-right px-4 py-3 font-medium">Total</th>
                      <th className="text-right px-4 py-3 font-medium">Segments</th>
                      <th className="text-center px-4 py-3 font-medium">Confidence</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(['ridges', 'rakes', 'valleys', 'eaves', 'hips'] as const).map(key => {
                      const m = r.measurements[key];
                      const display = getDisplayValue(key, m.totalFt);
                      const isExpanded = expandedRows.has(key);
                      const displayConf = display.isManual ? 'MANUAL' : m.confidence;
                      return (
                        <Fragment key={key}>
                          <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors" onClick={() => m.details.length > 0 && toggleRow(key)}>
                            <td className="px-6 py-3.5 font-medium capitalize">{key}</td>
                            <td className="text-right px-4 py-3.5 font-mono">
                              {display.value.toFixed(1)} ft
                              {display.isManual && <span className="text-purple-400 text-xs ml-1">✏</span>}
                            </td>
                            <td className="text-right px-4 py-3.5 text-zinc-400">{m.count}</td>
                            <td className="text-center px-4 py-3.5">
                              <span className={`px-2 py-0.5 rounded text-xs border ${confBg(displayConf)}`}>{displayConf}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              {m.details.length > 0 && (isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-600" /> : <ChevronDown className="w-4 h-4 text-zinc-600" />)}
                            </td>
                          </tr>
                          {isExpanded && m.details.map((d, i) => (
                            <tr key={i} className="bg-white/[0.01] text-zinc-500">
                              <td className="px-6 py-2 pl-12 text-sm">Segment {i + 1}</td>
                              <td className="text-right px-4 py-2 font-mono text-sm">{d.lengthFt.toFixed(1)} ft</td>
                              <td colSpan={3}></td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Pitch Breakdown ── */}
              {r.solarData.segments.length > 0 && (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 report-card">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TriangleRight className="w-5 h-5 text-emerald-400" /> Roof Segments & Pitch
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {r.solarData.segments.map((seg, i) => (
                      <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                        <div className="text-lg font-bold">{(seg.pitchDegrees * 12 / 45).toFixed(1)}/12</div>
                        <div className="text-xs text-zinc-400">{seg.pitchDegrees.toFixed(1)}° · {seg.direction}</div>
                        <div className="text-xs text-zinc-600">{seg.areaSqFt.toFixed(0)} sq ft</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Material Estimates ── */}
              <MaterialEstimates report={r} />

              {/* ── Components ── */}
              {r.components && <ComponentsSection components={r.components} />}

              {/* ── Photo Enhancement Comparison ── */}
              {r.mode === 'enhanced' && r.enhancedMeasurements && (
                <div className="bg-white/[0.02] border border-blue-500/20 rounded-2xl overflow-hidden report-card">
                  <div className="px-6 py-5 border-b border-white/[0.06]">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-blue-400" />
                      Satellite vs Photo-Enhanced
                    </h3>
                    {r.refinementNotes && <p className="text-sm text-zinc-500 mt-1">{r.refinementNotes}</p>}
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-zinc-500">
                          <th className="text-left py-2 pr-4 font-medium">Measurement</th>
                          <th className="text-right px-3 py-2 font-medium">Satellite</th>
                          <th className="text-right px-3 py-2 font-medium text-blue-400">Enhanced</th>
                          <th className="text-center px-3 py-2 font-medium">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(['ridges', 'rakes', 'valleys', 'eaves', 'hips'] as const).map(key => {
                          const satVal = r.satelliteMeasurements[key].totalFt;
                          const enhVal = r.enhancedMeasurements![key].totalFt;
                          const diff = satVal > 0 ? ((enhVal - satVal) / satVal * 100) : 0;
                          return (
                            <tr key={key} className="border-b border-white/[0.04]">
                              <td className="py-2.5 pr-4 capitalize">{key}</td>
                              <td className="text-right px-3 py-2.5 font-mono text-zinc-400">{satVal.toFixed(0)} ft</td>
                              <td className="text-right px-3 py-2.5 font-mono text-blue-400">{enhVal.toFixed(0)} ft</td>
                              <td className="text-center px-3 py-2.5 font-mono text-xs">
                                {diff !== 0 ? (
                                  <span className={diff > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                                    {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                                  </span>
                                ) : <span className="text-zinc-600">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── On-Site Enhancement (no-print) ── */}
              <OnSiteEnhancement report={r} onRerun={handleOnsiteRerun}
                manualOverrides={manualOverrides} setManualOverrides={setManualOverrides}
                manualNotes={manualNotes} setManualNotes={setManualNotes} />

              {/* ── AI Provider Comparison (no-print) ── */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden no-print">
                <button onClick={() => setAiPanelOpen(!aiPanelOpen)}
                  className="w-full px-6 py-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <h3 className="text-sm font-medium text-zinc-400">AI Provider Details</h3>
                  {aiPanelOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                </button>
                {aiPanelOpen && (
                  <div className="px-6 pb-5 space-y-4 border-t border-white/[0.04]">
                    <div className="flex gap-4 pt-4">
                      {(['gemini', 'geminiVerify', 'ollama'] as const).map(p => (
                        <div key={p} className="flex items-center gap-2 text-sm">
                          {statusIcon(r.satelliteAiResults[p].status)}
                          <span className="text-zinc-400">{p === 'geminiVerify' ? 'Gemini Verify' : p.charAt(0).toUpperCase() + p.slice(1)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/[0.06] text-zinc-500">
                            <th className="text-left py-2 pr-4 font-medium">Measurement</th>
                            <th className="text-right px-3 py-2 font-medium">Gemini</th>
                            <th className="text-right px-3 py-2 font-medium">Verify</th>
                            <th className="text-right px-3 py-2 font-medium">Ollama</th>
                            <th className="text-right px-3 py-2 font-medium text-emerald-400">Consensus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(['ridges', 'rakes', 'valleys', 'eaves', 'hips'] as const).map(key => {
                            const getVal = (ai: Record<string, unknown> | null) => {
                              if (!ai) return '—';
                              const k = `total_${key === 'ridges' ? 'ridge' : key === 'rakes' ? 'rake' : key === 'valleys' ? 'valley' : key === 'eaves' ? 'eave' : 'hip'}_ft`;
                              const v = (ai as Record<string, number>)[k];
                              return v != null ? `${v.toFixed(0)}` : '—';
                            };
                            return (
                              <tr key={key} className="border-b border-white/[0.04]">
                                <td className="py-2 pr-4 capitalize">{key}</td>
                                <td className="text-right px-3 py-2 font-mono text-zinc-400">{getVal(r.satelliteAiResults.gemini.measurements)}</td>
                                <td className="text-right px-3 py-2 font-mono text-zinc-400">{getVal(r.satelliteAiResults.geminiVerify.measurements)}</td>
                                <td className="text-right px-3 py-2 font-mono text-zinc-400">{getVal(r.satelliteAiResults.ollama.measurements)}</td>
                                <td className="text-right px-3 py-2 font-mono text-emerald-400">{r.satelliteMeasurements[key].totalFt.toFixed(0)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Quality Notes ── */}
              {r.qualityNotes.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 no-print">
                  <h3 className="font-semibold text-amber-400 mb-2 flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4" /> Quality Notes
                  </h3>
                  <ul className="text-sm text-amber-300/70 space-y-1">
                    {r.qualityNotes.map((note, i) => <li key={i}>• {note}</li>)}
                  </ul>
                </div>
              )}

              {/* ── Manual Notes (if entered) ── */}
              {manualNotes && (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 report-card">
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" /> On-Site Notes
                  </h3>
                  <p className="text-sm text-zinc-400 whitespace-pre-wrap">{manualNotes}</p>
                </div>
              )}

              {/* ── Footer ── */}
              <footer className="py-8 text-center space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <div className="h-px w-16 bg-white/[0.06]" />
                  <Image src="/logo-transparent.png" alt="RCRS" width={24} height={24} className="opacity-30" />
                  <div className="h-px w-16 bg-white/[0.06]" />
                </div>
                <p className="text-xs text-zinc-600">
                  This report is an AI-generated estimate based on satellite imagery{r.mode === 'enhanced' ? ' and uploaded photos' : ''}.
                  On-site verification is recommended before finalizing any project scope.
                </p>
                <div className="flex items-center justify-center gap-4 text-xs text-zinc-600">
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> (256) 274-8530</span>
                  <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> rivercityroofingsolutions.com</span>
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> info@rcrsal.com</span>
                </div>
              </footer>

              {/* ── Print-only footer ── */}
              <div className="print-only hidden" style={{ marginTop: '24pt', borderTop: '2px solid #059669', paddingTop: '10pt' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '8pt', color: '#6b7280' }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '9pt', color: '#111827', margin: '0 0 2pt 0' }}>River City Roofing Solutions</p>
                    <p style={{ margin: '0' }}>3325 Central Pkwy SW, Decatur, AL 35603</p>
                    <p style={{ margin: '0' }}>(256) 274-8530 · info@rcrsal.com</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '0' }}>Report generated: {new Date(r.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                    <p style={{ margin: '0' }}>Imagery date: {r.imageryDate}</p>
                    <p style={{ margin: '4pt 0 0 0', fontStyle: 'italic', fontSize: '7pt' }}>This report is an AI-generated estimate based on satellite imagery. On-site verification recommended before finalizing project scope.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
