'use client';

import { useState, useRef, useCallback } from 'react';

interface Vertex { id: string; x: number; y: number; label?: string }
interface Edge { from: string; to: string; type: string; length_ft: number; label?: string }
interface Section { vertices: string[]; pitch: string; area_sqft: number; direction: string; label?: string }
interface RoofOutline { vertices: Vertex[]; edges: Edge[]; sections: Section[] }

interface RoofDiagramProps {
  outline: RoofOutline | null;
  buildingWidth: number;
  buildingLength: number;
  roofStyle: string;
  totalArea: number;
  interactive?: boolean;
  onEdit?: (edgeIndex: number, newLength: number) => void;
}

const EDGE_COLORS: Record<string, string> = {
  ridge: '#FF4444',
  rake: '#44AA44',
  valley: '#4444FF',
  eave: '#FF8800',
  hip: '#AA44AA',
};

const EDGE_LABELS: Record<string, string> = {
  ridge: 'Ridge',
  rake: 'Rake',
  valley: 'Valley',
  eave: 'Eave',
  hip: 'Hip',
};

const EDGE_DASHES: Record<string, string> = {
  ridge: '8,4',
  rake: '',
  valley: '4,4',
  eave: '',
  hip: '12,4,4,4',
};

export default function RoofDiagram({ outline, buildingWidth, buildingLength, roofStyle, totalArea, interactive, onEdit }: RoofDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [editingEdge, setEditingEdge] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleEditStart = useCallback((idx: number, currentValue: number) => {
    if (!interactive) return;
    setEditingEdge(idx);
    setEditValue(currentValue.toFixed(1));
  }, [interactive]);

  const handleEditSave = useCallback(() => {
    if (editingEdge !== null && onEdit) {
      const val = parseFloat(editValue);
      if (!isNaN(val) && val > 0) onEdit(editingEdge, val);
    }
    setEditingEdge(null);
  }, [editingEdge, editValue, onEdit]);

  // Use AI outline if available, otherwise build from measurements
  const diagram = outline && outline.vertices?.length > 2
    ? outline
    : buildSimpleDiagram(buildingWidth, buildingLength, roofStyle, totalArea);

  if (!diagram || !diagram.vertices?.length) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 text-center">
        <p className="text-gray-400">Roof diagram unavailable</p>
      </div>
    );
  }

  // Calculate SVG viewBox
  const xs = diagram.vertices.map(v => v.x);
  const ys = diagram.vertices.map(v => v.y);
  const padding = 20;
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;
  const maxX = Math.max(...xs) + padding;
  const maxY = Math.max(...ys) + padding;
  const svgW = maxX - minX;
  const svgH = maxY - minY;

  const vertexMap = new Map(diagram.vertices.map(v => [v.id, v]));

  // Totals by type
  const totals: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const edge of diagram.edges) {
    totals[edge.type] = (totals[edge.type] || 0) + edge.length_ft;
    counts[edge.type] = (counts[edge.type] || 0) + 1;
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden print:border-black print:bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between print:border-black">
        <h3 className="text-white font-bold text-lg print:text-black">Roof Measurement Diagram</h3>
        <div className="text-right">
          <span className="text-white font-bold print:text-black">{Math.round(totalArea).toLocaleString()} sq ft</span>
          <span className="text-gray-400 text-sm ml-2 print:text-gray-600">({(totalArea / 100).toFixed(1)} squares)</span>
        </div>
      </div>

      {/* SVG */}
      <div className="p-4">
        <svg
          ref={svgRef}
          viewBox={`${minX} ${minY} ${svgW} ${svgH}`}
          className="w-full"
          style={{ maxHeight: '500px', minHeight: '280px' }}
        >
          {/* Grid */}
          <defs>
            <pattern id="roofgrid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#333" strokeWidth="0.3" />
            </pattern>
            <marker id="arrowN" markerWidth="4" markerHeight="3" refX="2" refY="1.5" orient="auto">
              <polygon points="0 0, 4 1.5, 0 3" fill="#888" />
            </marker>
          </defs>
          <rect x={minX} y={minY} width={svgW} height={svgH} fill="url(#roofgrid)" className="print:fill-white" />

          {/* Sections */}
          {diagram.sections?.map((section, i) => {
            const pts = section.vertices
              .map(vid => vertexMap.get(vid))
              .filter((v): v is Vertex => !!v);
            if (pts.length < 3) return null;
            const points = pts.map(v => `${v.x},${v.y}`).join(' ');
            const fills = [
              'rgba(100,150,200,0.15)', 'rgba(150,200,100,0.15)',
              'rgba(200,150,100,0.15)', 'rgba(150,100,200,0.15)',
              'rgba(200,200,100,0.15)', 'rgba(100,200,200,0.15)',
            ];
            const cx = pts.reduce((s, v) => s + v.x, 0) / pts.length;
            const cy = pts.reduce((s, v) => s + v.y, 0) / pts.length;
            return (
              <g key={`s${i}`}>
                <polygon points={points} fill={fills[i % fills.length]} stroke="#555" strokeWidth="0.5" />
                {section.label && (
                  <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle" fill="#999" fontSize="3" fontStyle="italic">{section.label}</text>
                )}
                {section.area_sqft > 0 && (
                  <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle" fill="#aaa" fontSize="2.5">{Math.round(section.area_sqft)} sf</text>
                )}
                {section.pitch && (
                  <text x={cx} y={cy + 5.5} textAnchor="middle" dominantBaseline="middle" fill="#777" fontSize="2">{section.pitch}</text>
                )}
              </g>
            );
          })}

          {/* Edges */}
          {diagram.edges.map((edge, i) => {
            const v1 = vertexMap.get(edge.from);
            const v2 = vertexMap.get(edge.to);
            if (!v1 || !v2) return null;
            const ek = `${edge.from}-${edge.to}`;
            const hovered = hoveredEdge === ek;
            const color = EDGE_COLORS[edge.type] || '#888';
            const dash = EDGE_DASHES[edge.type] || '';
            const mx = (v1.x + v2.x) / 2;
            const my = (v1.y + v2.y) / 2;
            const dx = v2.x - v1.x;
            const dy = v2.y - v1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = len > 0 ? -dy / len * 5 : 0;
            const ny = len > 0 ? dx / len * 5 : 0;
            const isEditing = editingEdge === i;

            return (
              <g
                key={`e${i}`}
                onMouseEnter={() => setHoveredEdge(ek)}
                onMouseLeave={() => setHoveredEdge(null)}
                style={{ cursor: interactive ? 'pointer' : 'default' }}
                onClick={() => handleEditStart(i, edge.length_ft)}
              >
                <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y} stroke="transparent" strokeWidth="5" />
                <line
                  x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                  stroke={color} strokeWidth={hovered ? 1.5 : 0.8}
                  strokeDasharray={dash} strokeLinecap="round"
                />
                {/* Label bg */}
                <rect
                  x={mx + nx - 8} y={my + ny - 2.8}
                  width="16" height="5.6" rx="1"
                  fill={hovered ? color : 'rgba(0,0,0,0.85)'}
                  stroke={color} strokeWidth="0.3"
                  className="print:fill-white print:stroke-current"
                />
                {!isEditing && (
                  <text
                    x={mx + nx} y={my + ny}
                    textAnchor="middle" dominantBaseline="middle"
                    fill={hovered ? '#fff' : color}
                    fontSize="3" fontWeight="bold" fontFamily="monospace"
                    className="print:fill-black"
                  >
                    {edge.length_ft.toFixed(1)}&apos;
                  </text>
                )}
                {hovered && !isEditing && (
                  <text
                    x={mx + nx} y={my + ny - 5}
                    textAnchor="middle" fill={color} fontSize="2.5" fontWeight="bold"
                  >
                    {EDGE_LABELS[edge.type] || edge.type}
                  </text>
                )}
              </g>
            );
          })}

          {/* Vertices */}
          {diagram.vertices.map(v => (
            <g key={v.id}>
              <circle cx={v.x} cy={v.y} r="1.2" fill="#fff" stroke="#333" strokeWidth="0.4" className="print:fill-black print:stroke-white" />
              {v.label && (
                <text x={v.x} y={v.y - 3} textAnchor="middle" fill="#666" fontSize="2">{v.label}</text>
              )}
            </g>
          ))}

          {/* North arrow */}
          <g transform={`translate(${maxX - 10}, ${minY + 10})`}>
            <line x1="0" y1="6" x2="0" y2="-6" stroke="#888" strokeWidth="0.5" markerEnd="url(#arrowN)" />
            <text x="0" y="-8" textAnchor="middle" fill="#888" fontSize="3.5" fontWeight="bold">N</text>
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="px-4 pb-2 flex flex-wrap gap-4 border-t border-gray-700 pt-3 print:border-black">
        {Object.entries(EDGE_COLORS).map(([type, color]) => {
          if (!totals[type]) return null;
          return (
            <div key={type} className="flex items-center gap-2">
              <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={color} strokeWidth="2" strokeDasharray={EDGE_DASHES[type] || ''} /></svg>
              <span className="text-gray-300 text-xs print:text-black">{EDGE_LABELS[type]}: <strong>{totals[type].toFixed(1)}&apos;</strong> ({counts[type]})</span>
            </div>
          );
        })}
      </div>

      {/* Summary boxes */}
      <div className="px-4 pb-4 pt-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
        {(['ridge', 'rake', 'valley', 'eave', 'hip'] as const).map(type => {
          const total = totals[type];
          if (!total && type !== 'ridge' && type !== 'eave') return null;
          return (
            <div key={type} className="bg-gray-800 rounded p-2 text-center print:bg-gray-100 print:border print:border-gray-300" style={{ borderLeft: `3px solid ${EDGE_COLORS[type]}` }}>
              <p className="text-gray-400 text-xs print:text-gray-600">{EDGE_LABELS[type]}s</p>
              <p className="text-white text-lg font-bold print:text-black">{total ? `${total.toFixed(1)}'` : '—'}</p>
              {counts[type] > 0 && <p className="text-gray-500 text-xs">{counts[type]} segments</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildSimpleDiagram(width: number, length: number, roofStyle: string, totalArea: number): RoofOutline {
  const w = width > 5 ? width : Math.sqrt(totalArea > 0 ? totalArea / 1.4 : 1600);
  const l = length > 5 ? length : w * 1.4;
  const style = (roofStyle || 'gable').toLowerCase();

  const vertices: Vertex[] = [];
  const edges: Edge[] = [];
  const sections: Section[] = [];

  // Estimate pitch from area vs footprint
  const footprint = w * l;
  const slopeFactor = totalArea > 0 && footprint > 0 ? totalArea / footprint : 1.12;
  const pitchRatio = Math.round(Math.sqrt(Math.max(0, slopeFactor * slopeFactor - 1)) * 12);
  const pitchStr = `${Math.max(4, Math.min(12, pitchRatio || 6))}/12`;
  const halfW = w / 2;
  const slopeLen = halfW * (slopeFactor || 1.12);

  if (style === 'hip' || style === 'combination') {
    const inset = w * 0.35;
    vertices.push(
      { id: 'V1', x: 0, y: 0, label: 'NW' },
      { id: 'V2', x: l, y: 0, label: 'NE' },
      { id: 'V3', x: l, y: w, label: 'SE' },
      { id: 'V4', x: 0, y: w, label: 'SW' },
      { id: 'V5', x: inset, y: halfW, label: 'Ridge W' },
      { id: 'V6', x: l - inset, y: halfW, label: 'Ridge E' },
    );
    const ridgeLen = Math.max(1, l - 2 * inset);
    const hipLen = Math.round(Math.sqrt(inset * inset + halfW * halfW) * 10) / 10;
    edges.push(
      { from: 'V1', to: 'V2', type: 'eave', length_ft: Math.round(l * 10) / 10, label: 'North' },
      { from: 'V2', to: 'V3', type: 'eave', length_ft: Math.round(w * 10) / 10, label: 'East' },
      { from: 'V3', to: 'V4', type: 'eave', length_ft: Math.round(l * 10) / 10, label: 'South' },
      { from: 'V4', to: 'V1', type: 'eave', length_ft: Math.round(w * 10) / 10, label: 'West' },
      { from: 'V5', to: 'V6', type: 'ridge', length_ft: Math.round(ridgeLen * 10) / 10, label: 'Main ridge' },
      { from: 'V1', to: 'V5', type: 'hip', length_ft: hipLen },
      { from: 'V2', to: 'V6', type: 'hip', length_ft: hipLen },
      { from: 'V3', to: 'V6', type: 'hip', length_ft: hipLen },
      { from: 'V4', to: 'V5', type: 'hip', length_ft: hipLen },
    );
    const sideArea = Math.round(totalArea * 0.2);
    const fbArea = Math.round(totalArea * 0.3);
    sections.push(
      { vertices: ['V1', 'V2', 'V6', 'V5'], pitch: pitchStr, area_sqft: fbArea, direction: 'N', label: 'Front' },
      { vertices: ['V2', 'V3', 'V6'], pitch: pitchStr, area_sqft: sideArea, direction: 'E', label: 'Right' },
      { vertices: ['V3', 'V4', 'V5', 'V6'], pitch: pitchStr, area_sqft: fbArea, direction: 'S', label: 'Back' },
      { vertices: ['V4', 'V1', 'V5'], pitch: pitchStr, area_sqft: sideArea, direction: 'W', label: 'Left' },
    );
  } else {
    // Gable
    vertices.push(
      { id: 'V1', x: 0, y: 0, label: 'NW' },
      { id: 'V2', x: l, y: 0, label: 'NE' },
      { id: 'V3', x: l, y: w, label: 'SE' },
      { id: 'V4', x: 0, y: w, label: 'SW' },
      { id: 'V5', x: 0, y: halfW, label: 'W peak' },
      { id: 'V6', x: l, y: halfW, label: 'E peak' },
    );
    const rakeLen = Math.round(slopeLen * 10) / 10;
    edges.push(
      { from: 'V1', to: 'V2', type: 'eave', length_ft: Math.round(l * 10) / 10, label: 'North' },
      { from: 'V3', to: 'V4', type: 'eave', length_ft: Math.round(l * 10) / 10, label: 'South' },
      { from: 'V5', to: 'V6', type: 'ridge', length_ft: Math.round(l * 10) / 10, label: 'Main ridge' },
      { from: 'V1', to: 'V5', type: 'rake', length_ft: rakeLen, label: 'NW rake' },
      { from: 'V5', to: 'V4', type: 'rake', length_ft: rakeLen, label: 'SW rake' },
      { from: 'V2', to: 'V6', type: 'rake', length_ft: rakeLen, label: 'NE rake' },
      { from: 'V6', to: 'V3', type: 'rake', length_ft: rakeLen, label: 'SE rake' },
    );
    sections.push(
      { vertices: ['V1', 'V2', 'V6', 'V5'], pitch: pitchStr, area_sqft: Math.round(totalArea * 0.5), direction: 'N', label: 'Front slope' },
      { vertices: ['V5', 'V6', 'V3', 'V4'], pitch: pitchStr, area_sqft: Math.round(totalArea * 0.5), direction: 'S', label: 'Back slope' },
    );
  }

  return { vertices, edges, sections };
}
