/**
 * Extract roof measurements from a GAF QuickMeasure "Full Report" PDF.
 *
 * The QuickMeasure XML is only vector geometry — the roll-up MEASUREMENTS live
 * on the PDF's "Summary" page (page 7) and the suggested waste on the
 * "Roofing Materials" page (page 8). We read the PDF text with pdf-parse and
 * regex the Summary block. pdf-parse joins each label directly to its value
 * (e.g. "Eaves525 ft", "Leak Barrier1,448 ft"), so the patterns have no gap.
 *
 * Deterministic + free — no AI/API needed.
 */

// pdf-parse's index.js runs a debug harness when required as main; import the
// lib entry directly to avoid it in the serverless bundle.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const pdfParse: (b: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse.js');

import type { Measurements } from './coverage-config';

const num = (s?: string): number | undefined => {
  if (s == null) return undefined;
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

export async function extractMeasurementsFromPdf(pdf: Buffer): Promise<{ measurements: Measurements; ok: boolean; textLen: number }> {
  let text = '';
  try {
    text = (await pdfParse(pdf)).text || '';
  } catch (err) {
    console.error('[gaf] pdf-parse failed', err);
    return { measurements: {}, ok: false, textLen: 0 };
  }

  // Isolate the Summary block: from the LAST "Roof Area" (summary page, not the
  // page-1 overview) to the notes footer. Falls back to whole text.
  const last = text.lastIndexOf('Roof Area');
  const notes = text.indexOf('Notes:', last);
  const block = last >= 0 ? text.slice(last, notes > last ? notes : last + 600) : text;

  const g = (re: RegExp, src = block): number | undefined => num((src.match(re) || [])[1]);

  const roofAreaSqFt = g(/Roof Area([\d,]+)\s*sq\s*ft/i);
  const pitchN = g(/Pitch(\d+)\s*\/\s*12/i);

  // Suggested waste: the Materials-page header "Waste0%16%21%26%" is immediately
  // followed by "Suggested"; its 3rd column (middle) is GAF's suggested %.
  // (Anchoring on "Suggested" avoids the Summary page's 7-column waste table,
  // where Area/Squares rows sit between the %s and the "Suggested" marker.)
  const wasteMatch = text.match(/Waste\s*0%\s*(\d+)%\s*(\d+)%\s*(\d+)%\s*\n?\s*Suggested/i);
  const suggestedWaste = wasteMatch ? parseInt(wasteMatch[2], 10) / 100 : undefined;

  const measurements: Measurements = {
    roofAreaSqFt,
    squares: roofAreaSqFt != null ? roofAreaSqFt / 100 : undefined,
    predominantPitch: pitchN != null ? `${pitchN}/12` : undefined,
    facets: g(/Roof Facets(\d+)/i),
    eaveLengthFt: g(/Eaves([\d,]+)\s*ft/i),
    rakeLengthFt: g(/Rakes([\d,]+)\s*ft/i),
    ridgeLengthFt: g(/Ridges([\d,]+)\s*ft/i),
    hipLengthFt: g(/Hips([\d,]+)\s*ft/i),
    valleyLengthFt: g(/Valleys([\d,]+)\s*ft/i),
    flashLengthFt: g(/Flash([\d,]+)\s*ft/i),
    stepLengthFt: g(/Step([\d,]+)\s*ft/i),
    dripEdgeLengthFt: g(/Drip Edge([\d,]+)\s*ft/i),
    leakBarrierLengthFt: g(/Leak Barrier([\d,]+)\s*ft/i),
    ridgeCapLengthFt: g(/Ridge Cap([\d,]+)\s*ft/i),
    starterLengthFt: g(/Starter([\d,]+)\s*ft/i),
    penetrations: g(/Penetrations(\d+)/i),
    penetrationPerimeterFt: g(/Pen\.?\s*Perimeter([\d,]+)\s*ft/i),
    suggestedWaste,
  };

  const ok = measurements.roofAreaSqFt != null && measurements.eaveLengthFt != null;
  return { measurements, ok, textLen: text.length };
}
