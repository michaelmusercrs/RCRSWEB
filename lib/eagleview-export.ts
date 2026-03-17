/**
 * EagleView XML Export for JobNimbus Sync
 * 
 * Generates EagleView-compatible XML format from roof measurement data.
 * This format is recognized by JobNimbus CRM for automatic import.
 */

interface MeasurementItem {
  totalFt: number;
  count: number;
  details: { lengthFt: number }[];
  confidence: string;
}

interface ExportMeasurements {
  ridges: MeasurementItem;
  rakes: MeasurementItem;
  valleys: MeasurementItem;
  eaves: MeasurementItem;
  hips: MeasurementItem;
  pitches: { primary: string; all: { pitch: string; segmentArea?: number }[]; confidence: string };
  roofStyle: string;
  perimeterFt: number;
}

interface ExportComponents {
  flashing: { type?: string; length_ft?: number; confidence: string }[];
  transitions: { length_ft?: number; description?: string; confidence: string }[];
  vents: { type?: string; count?: number; confidence: string }[];
  pipes: { diameter_in?: number; count?: number; confidence: string }[];
  chimneys: { width_ft?: number; length_ft?: number; flashing_perimeter_ft?: number; confidence: string }[];
  skylights: { width_ft?: number; length_ft?: number; flashing_perimeter_ft?: number; confidence: string }[];
}

interface ExportData {
  address: string;
  lat: number;
  lng: number;
  generatedAt: string;
  totalRoofAreaSqFt: number;
  measurements: ExportMeasurements;
  components: ExportComponents;
  overallConfidence: string;
  overrides?: Record<string, number>;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function pitchToSlope(pitch: string): number {
  const match = pitch.match(/(\d+(?:\.\d+)?)\s*\/\s*12/);
  if (!match) return 0;
  return parseFloat(match[1]);
}

export function generateEagleViewXml(data: ExportData): string {
  const m = data.measurements;
  const c = data.components;
  const squares = Math.round(data.totalRoofAreaSqFt / 100 * 10) / 10;
  const wastePercent = m.roofStyle === 'hip' ? 15 : m.roofStyle === 'gable' ? 10 : 12;
  const totalWithWaste = Math.round(data.totalRoofAreaSqFt * (1 + wastePercent / 100));
  const squaresWithWaste = Math.round(totalWithWaste / 100 * 10) / 10;
  const slope = pitchToSlope(m.pitches.primary);

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<EagleViewReport>');
  lines.push('  <ReportInfo>');
  lines.push(`    <GeneratedDate>${escapeXml(data.generatedAt)}</GeneratedDate>`);
  lines.push(`    <Address>${escapeXml(data.address)}</Address>`);
  lines.push(`    <Latitude>${data.lat}</Latitude>`);
  lines.push(`    <Longitude>${data.lng}</Longitude>`);
  lines.push(`    <ConfidenceLevel>${escapeXml(data.overallConfidence)}</ConfidenceLevel>`);
  lines.push(`    <Source>RCRS AI Measurement Tool</Source>`);
  lines.push('  </ReportInfo>');

  lines.push('  <RoofSummary>');
  lines.push(`    <TotalArea>${Math.round(data.totalRoofAreaSqFt)}</TotalArea>`);
  lines.push(`    <TotalSquares>${squares}</TotalSquares>`);
  lines.push(`    <WastePercent>${wastePercent}</WastePercent>`);
  lines.push(`    <TotalWithWaste>${totalWithWaste}</TotalWithWaste>`);
  lines.push(`    <SquaresWithWaste>${squaresWithWaste}</SquaresWithWaste>`);
  lines.push(`    <PredominantPitch>${escapeXml(m.pitches.primary)}</PredominantPitch>`);
  lines.push(`    <PredominantSlope>${slope}</PredominantSlope>`);
  lines.push(`    <RoofStyle>${escapeXml(m.roofStyle)}</RoofStyle>`);
  lines.push(`    <Perimeter>${m.perimeterFt}</Perimeter>`);
  lines.push('  </RoofSummary>');

  lines.push('  <LinearMeasurements>');
  lines.push(`    <Ridges total="${m.ridges.totalFt}" count="${m.ridges.count}" confidence="${m.ridges.confidence}">`);
  for (const d of m.ridges.details) {
    lines.push(`      <Ridge length="${d.lengthFt}" />`);
  }
  lines.push('    </Ridges>');
  lines.push(`    <Hips total="${m.hips.totalFt}" count="${m.hips.count}" confidence="${m.hips.confidence}">`);
  for (const d of m.hips.details) {
    lines.push(`      <Hip length="${d.lengthFt}" />`);
  }
  lines.push('    </Hips>');
  lines.push(`    <Valleys total="${m.valleys.totalFt}" count="${m.valleys.count}" confidence="${m.valleys.confidence}">`);
  for (const d of m.valleys.details) {
    lines.push(`      <Valley length="${d.lengthFt}" />`);
  }
  lines.push('    </Valleys>');
  lines.push(`    <Rakes total="${m.rakes.totalFt}" count="${m.rakes.count}" confidence="${m.rakes.confidence}">`);
  for (const d of m.rakes.details) {
    lines.push(`      <Rake length="${d.lengthFt}" />`);
  }
  lines.push('    </Rakes>');
  lines.push(`    <Eaves total="${m.eaves.totalFt}" count="${m.eaves.count}" confidence="${m.eaves.confidence}">`);
  for (const d of m.eaves.details) {
    lines.push(`      <Eave length="${d.lengthFt}" />`);
  }
  lines.push('    </Eaves>');
  lines.push('  </LinearMeasurements>');

  lines.push('  <Pitches>');
  for (const p of m.pitches.all) {
    const s = pitchToSlope(p.pitch);
    lines.push(`    <Pitch slope="${s}" ratio="${escapeXml(p.pitch)}" area="${p.segmentArea || 0}" />`);
  }
  lines.push('  </Pitches>');

  // Components / Penetrations
  lines.push('  <Penetrations>');
  for (const ch of c.chimneys) {
    lines.push(`    <Chimney width="${ch.width_ft || 0}" length="${ch.length_ft || 0}" flashingPerimeter="${ch.flashing_perimeter_ft || 0}" confidence="${ch.confidence}" />`);
  }
  for (const sk of c.skylights) {
    lines.push(`    <Skylight width="${sk.width_ft || 0}" length="${sk.length_ft || 0}" flashingPerimeter="${sk.flashing_perimeter_ft || 0}" confidence="${sk.confidence}" />`);
  }
  for (const v of c.vents) {
    lines.push(`    <Vent type="${escapeXml(v.type || 'unknown')}" count="${v.count || 0}" confidence="${v.confidence}" />`);
  }
  for (const p of c.pipes) {
    lines.push(`    <Pipe diameter="${p.diameter_in || 0}" count="${p.count || 0}" confidence="${p.confidence}" />`);
  }
  lines.push('  </Penetrations>');

  // Flashing
  lines.push('  <Flashing>');
  for (const f of c.flashing) {
    lines.push(`    <FlashingItem type="${escapeXml(f.type || 'unknown')}" length="${f.length_ft || 0}" confidence="${f.confidence}" />`);
  }
  for (const t of c.transitions) {
    lines.push(`    <Transition length="${t.length_ft || 0}" description="${escapeXml(t.description || '')}" confidence="${t.confidence}" />`);
  }
  lines.push('  </Flashing>');

  // Override markers
  if (data.overrides && Object.keys(data.overrides).length > 0) {
    lines.push('  <FieldVerifications>');
    for (const [field, value] of Object.entries(data.overrides)) {
      lines.push(`    <Verified field="${escapeXml(field)}" value="${value}" />`);
    }
    lines.push('  </FieldVerifications>');
  }

  lines.push('</EagleViewReport>');
  return lines.join('\n');
}
