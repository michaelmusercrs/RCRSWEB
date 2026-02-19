'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PenLine, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Vertex { id: string; x: number; y: number; label?: string; }
interface Edge { from: string; to: string; type: string; length_ft: number; label?: string; }
interface Section { vertices: string[]; pitch: string; area_sqft: number; direction: string; label?: string; }

interface RoofOutline {
  vertices: Vertex[];
  edges: Edge[];
  sections: Section[];
}

interface MeasurementOverrides {
  [edgeKey: string]: number; // "V1-V2" -> overridden length
}

interface PitchOverrides {
  [sectionIdx: number]: string; // section index -> overridden pitch
}

interface Props {
  outline: RoofOutline | null;
  buildingWidth: number;
  buildingLength: number;
  roofStyle: string;
  totalArea: number;
  onMeasurementChange?: (edgeKey: string, newValue: number) => void;
  onPitchChange?: (sectionIdx: number, newPitch: string) => void;
  interactive?: boolean;
}

// ── Color Map ──────────────────────────────────────────────────────────────

const EDGE_COLORS: Record<string, string> = {
  ridge: '#ef4444',   // red
  rake: '#3b82f6',    // blue
  valley: '#f59e0b',  // amber
  eave: '#10b981',    // emerald
  hip: '#8b5cf6',     // purple
};

const EDGE_COLORS_PRINT: Record<string, string> = {
  ridge: '#dc2626',
  rake: '#2563eb',
  valley: '#d97706',
  eave: '#059669',
  hip: '#7c3aed',
};

const SECTION_FILLS = [
  'rgba(16,185,129,0.08)', 'rgba(59,130,246,0.08)',
  'rgba(245,158,11,0.08)', 'rgba(139,92,246,0.08)',
  'rgba(236,72,153,0.08)', 'rgba(14,165,233,0.08)',
];

// ── Helpers ────────────────────────────────────────────────────────────────

function midpoint(v1: Vertex, v2: Vertex) {
  return { x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 };
}

function edgeAngle(v1: Vertex, v2: Vertex) {
  return Math.atan2(v2.y - v1.y, v2.x - v1.x) * (180 / Math.PI);
}

function normalOffset(v1: Vertex, v2: Vertex, dist: number) {
  const dx = v2.x - v1.x;
  const dy = v2.y - v1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x: 0, y: 0 };
  return { x: -dy / len * dist, y: dx / len * dist };
}

// ── Generate fallback outline from building dimensions ─────────────────────

function generateFallbackOutline(width: number, length: number, roofStyle: string, totalArea: number): RoofOutline {
  const w = width || 40;
  const l = length || 50;
  const pad = 2; // small padding

  if (roofStyle === 'hip') {
    const inset = w * 0.35;
    return {
      vertices: [
        { id: 'V1', x: pad, y: pad, label: 'NW corner' },
        { id: 'V2', x: w + pad, y: pad, label: 'NE corner' },
        { id: 'V3', x: w + pad, y: l + pad, label: 'SE corner' },
        { id: 'V4', x: pad, y: l + pad, label: 'SW corner' },
        { id: 'V5', x: inset + pad, y: pad + inset * 0.6, label: 'Ridge NW' },
        { id: 'V6', x: w - inset + pad, y: pad + inset * 0.6, label: 'Ridge NE' },
        { id: 'V7', x: w - inset + pad, y: l - inset * 0.6 + pad, label: 'Ridge SE' },
        { id: 'V8', x: inset + pad, y: l - inset * 0.6 + pad, label: 'Ridge SW' },
      ],
      edges: [
        { from: 'V1', to: 'V2', type: 'eave', length_ft: Math.round(w), label: 'Front eave' },
        { from: 'V2', to: 'V3', type: 'eave', length_ft: Math.round(l), label: 'Right eave' },
        { from: 'V3', to: 'V4', type: 'eave', length_ft: Math.round(w), label: 'Back eave' },
        { from: 'V4', to: 'V1', type: 'eave', length_ft: Math.round(l), label: 'Left eave' },
        { from: 'V5', to: 'V6', type: 'ridge', length_ft: Math.round(w - 2 * inset), label: 'Front ridge' },
        { from: 'V7', to: 'V8', type: 'ridge', length_ft: Math.round(w - 2 * inset), label: 'Back ridge' },
        { from: 'V6', to: 'V7', type: 'ridge', length_ft: Math.round(l - 2 * inset * 0.6), label: 'Main ridge' },
        { from: 'V5', to: 'V8', type: 'ridge', length_ft: Math.round(l - 2 * inset * 0.6), label: 'Left ridge' },
        { from: 'V1', to: 'V5', type: 'hip', length_ft: Math.round(Math.sqrt(inset * inset + (inset * 0.6) * (inset * 0.6))), label: 'NW hip' },
        { from: 'V2', to: 'V6', type: 'hip', length_ft: Math.round(Math.sqrt(inset * inset + (inset * 0.6) * (inset * 0.6))), label: 'NE hip' },
        { from: 'V3', to: 'V7', type: 'hip', length_ft: Math.round(Math.sqrt(inset * inset + (inset * 0.6) * (inset * 0.6))), label: 'SE hip' },
        { from: 'V4', to: 'V8', type: 'hip', length_ft: Math.round(Math.sqrt(inset * inset + (inset * 0.6) * (inset * 0.6))), label: 'SW hip' },
      ],
      sections: [
        { vertices: ['V1', 'V2', 'V6', 'V5'], pitch: '6/12', area_sqft: Math.round(totalArea * 0.3), direction: 'N', label: 'Front slope' },
        { vertices: ['V2', 'V3', 'V7', 'V6'], pitch: '6/12', area_sqft: Math.round(totalArea * 0.2), direction: 'E', label: 'Right slope' },
        { vertices: ['V3', 'V4', 'V8', 'V7'], pitch: '6/12', area_sqft: Math.round(totalArea * 0.3), direction: 'S', label: 'Back slope' },
        { vertices: ['V4', 'V1', 'V5', 'V8'], pitch: '6/12', area_sqft: Math.round(totalArea * 0.2), direction: 'W', label: 'Left slope' },
      ],
    };
  }

  // Default: gable
  const ridgeY = (l + 2 * pad) / 2;
  return {
    vertices: [
      { id: 'V1', x: pad, y: pad, label: 'NW corner' },
      { id: 'V2', x: w + pad, y: pad, label: 'NE corner' },
      { id: 'V3', x: w + pad, y: l + pad, label: 'SE corner' },
      { id: 'V4', x: pad, y: l + pad, label: 'SW corner' },
      { id: 'V5', x: w / 2 + pad, y: pad, label: 'Front gable peak' },
      { id: 'V6', x: w / 2 + pad, y: l + pad, label: 'Back gable peak' },
    ],
    edges: [
      { from: 'V1', to: 'V5', type: 'rake', length_ft: Math.round(Math.sqrt((w / 2) ** 2 + 0)), label: 'Front left rake' },
      { from: 'V5', to: 'V2', type: 'rake', length_ft: Math.round(Math.sqrt((w / 2) ** 2 + 0)), label: 'Front right rake' },
      { from: 'V2', to: 'V3', type: 'eave', length_ft: Math.round(l), label: 'Right eave' },
      { from: 'V3', to: 'V6', type: 'rake', length_ft: Math.round(Math.sqrt((w / 2) ** 2 + 0)), label: 'Back right rake' },
      { from: 'V6', to: 'V4', type: 'rake', length_ft: Math.round(Math.sqrt((w / 2) ** 2 + 0)), label: 'Back left rake' },
      { from: 'V4', to: 'V1', type: 'eave', length_ft: Math.round(l), label: 'Left eave' },
      { from: 'V5', to: 'V6', type: 'ridge', length_ft: Math.round(l), label: 'Main ridge' },
    ],
    sections: [
      { vertices: ['V1', 'V5', 'V6', 'V4'], pitch: '6/12', area_sqft: Math.round(totalArea / 2), direction: 'W', label: 'Left slope' },
      { vertices: ['V5', 'V2', 'V3', 'V6'], pitch: '6/12', area_sqft: Math.round(totalArea / 2), direction: 'E', label: 'Right slope' },
    ],
  };
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function RoofDiagram({
  outline, buildingWidth, buildingLength, roofStyle, totalArea,
  onMeasurementChange, onPitchChange, interactive = true,
}: Props) {
  const [measurementOverrides, setMeasurementOverrides] = useState<MeasurementOverrides>({});
  const [pitchOverrides, setPitchOverrides] = useState<PitchOverrides>({});
  const [editingEdge, setEditingEdge] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [zoom, setZoom] = useState(1);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use AI outline or generate fallback
  const data = useMemo(() => {
    if (outline && outline.vertices?.length >= 3 && outline.edges?.length >= 3) return outline;
    return generateFallbackOutline(buildingWidth, buildingLength, roofStyle, totalArea);
  }, [outline, buildingWidth, buildingLength, roofStyle, totalArea]);

  // Compute SVG viewBox from vertices
  const viewBox = useMemo(() => {
    const xs = data.vertices.map(v => v.x);
    const ys = data.vertices.map(v => v.y);
    const minX = Math.min(...xs) - 8;
    const minY = Math.min(...ys) - 8;
    const maxX = Math.max(...xs) + 8;
    const maxY = Math.max(...ys) + 8;
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }, [data]);

  const vertexMap = useMemo(() => {
    const m = new Map<string, Vertex>();
    data.vertices.forEach(v => m.set(v.id, v));
    return m;
  }, [data]);

  const getEdgeLength = useCallback((edge: Edge) => {
    const key = `${edge.from}-${edge.to}`;
    return measurementOverrides[key] ?? edge.length_ft;
  }, [measurementOverrides]);

  const getSectionPitch = useCallback((idx: number) => {
    return pitchOverrides[idx] ?? data.sections[idx]?.pitch ?? 'N/A';
  }, [pitchOverrides, data]);

  const handleEdgeClick = useCallback((edge: Edge) => {
    if (!interactive) return;
    const key = `${edge.from}-${edge.to}`;
    setEditingEdge(key);
    setEditValue(String(getEdgeLength(edge)));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [interactive, getEdgeLength]);

  const handleSectionClick = useCallback((idx: number) => {
    if (!interactive) return;
    setEditingSection(idx);
    setEditValue(getSectionPitch(idx));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [interactive, getSectionPitch]);

  const commitEdit = useCallback(() => {
    if (editingEdge) {
      const val = parseFloat(editValue);
      if (!isNaN(val) && val > 0) {
        setMeasurementOverrides(prev => ({ ...prev, [editingEdge]: val }));
        onMeasurementChange?.(editingEdge, val);
      }
      setEditingEdge(null);
    }
    if (editingSection !== null) {
      const val = editValue.trim();
      if (val.match(/^\d+\/12$/)) {
        setPitchOverrides(prev => ({ ...prev, [editingSection!]: val }));
        onPitchChange?.(editingSection!, val);
      }
      setEditingSection(null);
    }
    setEditValue('');
  }, [editingEdge, editingSection, editValue, onMeasurementChange, onPitchChange]);

  const resetOverrides = useCallback(() => {
    setMeasurementOverrides({});
    setPitchOverrides({});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') commitEdit();
      if (e.key === 'Escape') { setEditingEdge(null); setEditingSection(null); setEditValue(''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commitEdit]);

  const hasOverrides = Object.keys(measurementOverrides).length > 0 || Object.keys(pitchOverrides).length > 0;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden report-card print-section">
      <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M3 21V8l9-5 9 5v13"/><path d="M9 21V12h6v9"/></svg>
            Roof Diagram
          </h3>
          <p className="text-sm text-zinc-500 mt-1">
            {interactive ? 'Click any measurement to edit · ' : ''}
            <span className="text-red-400">■</span> Ridge
            <span className="ml-2 text-blue-400">■</span> Rake
            <span className="ml-2 text-amber-400">■</span> Valley
            <span className="ml-2 text-emerald-400">■</span> Eave
            <span className="ml-2 text-purple-400">■</span> Hip
          </p>
        </div>
        {interactive && (
          <div className="flex items-center gap-2 no-print">
            {hasOverrides && (
              <button onClick={resetOverrides} className="px-3 py-1.5 text-xs bg-white/[0.05] border border-white/[0.1] rounded-lg hover:bg-white/[0.1] flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
            <button onClick={() => setZoom(z => Math.min(z + 0.2, 2))} className="p-1.5 bg-white/[0.05] border border-white/[0.1] rounded-lg hover:bg-white/[0.1]">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))} className="p-1.5 bg-white/[0.05] border border-white/[0.1] rounded-lg hover:bg-white/[0.1]">
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="p-6 flex justify-center" style={{ minHeight: '400px' }}>
        <svg
          ref={svgRef}
          viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
          style={{ width: `${Math.min(700, viewBox.width * 8) * zoom}px`, height: `${Math.min(500, viewBox.height * 8) * zoom}px`, maxWidth: '100%' }}
          className="overflow-visible"
        >
          {/* Sections (filled polygons) */}
          {data.sections.map((section, idx) => {
            const points = section.vertices
              .map(vid => vertexMap.get(vid))
              .filter((v): v is Vertex => !!v)
              .map(v => `${v.x},${v.y}`)
              .join(' ');
            const sectionVerts = section.vertices.map(vid => vertexMap.get(vid)).filter((v): v is Vertex => !!v);
            const cx = sectionVerts.reduce((s, v) => s + v.x, 0) / sectionVerts.length;
            const cy = sectionVerts.reduce((s, v) => s + v.y, 0) / sectionVerts.length;
            const pitch = getSectionPitch(idx);
            const isEditing = editingSection === idx;

            return (
              <g key={`section-${idx}`}>
                <polygon
                  points={points}
                  fill={SECTION_FILLS[idx % SECTION_FILLS.length]}
                  stroke="none"
                  className={interactive ? 'cursor-pointer hover:opacity-80' : ''}
                  onClick={() => handleSectionClick(idx)}
                />
                {/* Section label (pitch + area) */}
                <text x={cx} y={cy - 1.5} textAnchor="middle" fontSize="2.5" fill="#9ca3af" fontWeight="600">
                  {section.label || `Section ${idx + 1}`}
                </text>
                <text
                  x={cx} y={cy + 1.5} textAnchor="middle" fontSize="3" fontWeight="700"
                  fill={isEditing ? '#34d399' : '#e5e7eb'}
                  className={interactive ? 'cursor-pointer' : ''}
                  onClick={() => handleSectionClick(idx)}
                >
                  {pitch}
                </text>
                <text x={cx} y={cy + 4.5} textAnchor="middle" fontSize="2" fill="#6b7280">
                  {section.area_sqft.toLocaleString()} sf
                </text>
              </g>
            );
          })}

          {/* Edges (lines with labels) */}
          {data.edges.map((edge, idx) => {
            const v1 = vertexMap.get(edge.from);
            const v2 = vertexMap.get(edge.to);
            if (!v1 || !v2) return null;

            const key = `${edge.from}-${edge.to}`;
            const len = getEdgeLength(edge);
            const isOverridden = key in measurementOverrides;
            const isEditing = editingEdge === key;
            const isHovered = hoveredEdge === key;
            const color = EDGE_COLORS[edge.type] || '#9ca3af';
            const mid = midpoint(v1, v2);
            const offset = normalOffset(v1, v2, 3);
            const angle = edgeAngle(v1, v2);
            const flipLabel = angle > 90 || angle < -90;

            return (
              <g key={`edge-${idx}`}
                onMouseEnter={() => setHoveredEdge(key)}
                onMouseLeave={() => setHoveredEdge(null)}
              >
                {/* Edge line */}
                <line
                  x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                  stroke={color}
                  strokeWidth={isHovered || isEditing ? 1 : 0.6}
                  strokeDasharray={edge.type === 'ridge' ? '2,1' : edge.type === 'valley' ? '1,1' : 'none'}
                  className={interactive ? 'cursor-pointer' : ''}
                  onClick={() => handleEdgeClick(edge)}
                />
                {/* Measurement label */}
                <g
                  transform={`translate(${mid.x + offset.x}, ${mid.y + offset.y}) rotate(${flipLabel ? angle + 180 : angle})`}
                  className={interactive ? 'cursor-pointer' : ''}
                  onClick={() => handleEdgeClick(edge)}
                >
                  <rect x="-7" y="-2.5" width="14" height="5" rx="1"
                    fill={isEditing ? '#059669' : isOverridden ? '#7c3aed' : 'rgba(0,0,0,0.7)'}
                    stroke={isHovered ? color : 'transparent'} strokeWidth="0.3"
                  />
                  <text textAnchor="middle" y="1" fontSize="2.5" fontWeight="700"
                    fill={isOverridden ? '#c4b5fd' : 'white'}
                  >
                    {Math.round(len * 10) / 10}&apos;
                  </text>
                  {isOverridden && (
                    <text textAnchor="middle" y="-3.5" fontSize="1.5" fill="#a78bfa">✏ edited</text>
                  )}
                </g>
                {/* Edge type label on hover */}
                {isHovered && (
                  <text x={mid.x + offset.x} y={mid.y + offset.y - 5} textAnchor="middle" fontSize="1.8" fill={color} fontWeight="600">
                    {edge.label || edge.type}
                  </text>
                )}
              </g>
            );
          })}

          {/* Vertices (dots) */}
          {data.vertices.map(v => (
            <circle key={v.id} cx={v.x} cy={v.y} r="0.8" fill="#e5e7eb" stroke="#374151" strokeWidth="0.3" />
          ))}

          {/* Compass indicator */}
          <g transform={`translate(${viewBox.minX + viewBox.width - 6}, ${viewBox.minY + 6})`}>
            <circle r="4" fill="rgba(0,0,0,0.3)" stroke="#6b7280" strokeWidth="0.3" />
            <line x1="0" y1="3" x2="0" y2="-3" stroke="#e5e7eb" strokeWidth="0.4" />
            <line x1="-3" y1="0" x2="3" y2="0" stroke="#6b7280" strokeWidth="0.3" />
            <text x="0" y="-3.8" textAnchor="middle" fontSize="2" fill="#e5e7eb" fontWeight="700">N</text>
          </g>
        </svg>
      </div>

      {/* Inline editor */}
      {(editingEdge || editingSection !== null) && (
        <div className="px-6 pb-4 no-print">
          <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-xl p-3">
            <PenLine className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-sm text-zinc-400">
              {editingEdge ? `Edit measurement (ft):` : `Edit pitch (X/12):`}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              className="px-3 py-1.5 bg-white/[0.06] border border-emerald-500/30 rounded-lg text-sm text-white w-24 focus:outline-none focus:border-emerald-500"
              placeholder={editingEdge ? '0.0' : '6/12'}
            />
            <button onClick={commitEdit} className="px-3 py-1.5 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600">
              Save
            </button>
            <button onClick={() => { setEditingEdge(null); setEditingSection(null); setEditValue(''); }}
              className="px-3 py-1.5 text-zinc-400 text-sm hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
