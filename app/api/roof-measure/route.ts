import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 900; // 15 minutes max
export const dynamic = 'force-dynamic';

// ── Types ──────────────────────────────────────────────────────────────────

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

interface AIMeasurements {
  ridges: { length_ft: number; confidence: string }[];
  rakes: { length_ft: number; confidence: string }[];
  valleys: { length_ft: number; confidence: string }[];
  eaves: { length_ft: number; confidence: string }[];
  hips: { length_ft: number; confidence: string }[];
  pitches: { pitch: string; confidence: string }[];
  total_ridge_ft: number;
  total_rake_ft: number;
  total_valley_ft: number;
  total_eave_ft: number;
  total_hip_ft: number;
  primary_pitch: string;
  roof_style: string;
  notes: string;
  refinement_notes?: string;
  components?: RoofComponents;
}

interface AIResult {
  status: string;
  measurements: AIMeasurements | null;
  raw?: string;
}

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// ── Helpers ────────────────────────────────────────────────────────────────

async function geocode(address: string) {
  // Bias geocoding to North Alabama (Decatur/Hartselle area)
  const bounds = '34.35,-87.20|34.75,-86.70'; // SW|NE covering service area
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&bounds=${encodeURIComponent(bounds)}&region=us&key=${GOOGLE_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results?.length) throw new Error('Address not found');
  const loc = data.results[0].geometry.location;
  const formatted = data.results[0].formatted_address as string;
  return { lat: loc.lat as number, lng: loc.lng as number, formatted };
}

async function getSolarData(lat: number, lng: number) {
  for (const quality of ['HIGH', 'MEDIUM', 'BASE']) {
    try {
      const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=${quality}&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.error) continue;
      return data;
    } catch { continue; }
  }
  return null;
}

async function fetchImageBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 5000) return null;
    return buf.toString('base64');
  } catch { return null; }
}

function azimuthToDirection(az: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(az / 45) % 8];
}

const COMPONENTS_PROMPT_SECTION = `
7. ROOF COMPONENTS & PENETRATIONS: Identify all visible roof components:
   - FLASHING: wall flashing, step flashing, counter flashing — estimate linear feet, type
   - TRANSITIONS: where roof planes change height or angle — estimate linear feet, describe
   - VENTS: pipe boots, box vents, ridge vents, turbine vents, power vents — count each type
   - PIPES/PENETRATIONS: plumbing vents, HVAC penetrations — count and estimate diameter in inches
   - CHIMNEYS: count, estimate width × length in feet, flashing perimeter in feet
   - SKYLIGHTS: count, estimate width × length in feet, flashing perimeter in feet

For each component, provide a confidence score: HIGH, MEDIUM, or LOW.`;

const COMPONENTS_JSON_FORMAT = `
  "components": {
    "flashing": [{"type": "wall|step|counter", "length_ft": number, "confidence": "HIGH|MEDIUM|LOW"}],
    "transitions": [{"length_ft": number, "description": "string", "confidence": "HIGH|MEDIUM|LOW"}],
    "vents": [{"type": "pipe_boot|box|ridge|turbine|power", "count": number, "confidence": "HIGH|MEDIUM|LOW"}],
    "pipes": [{"diameter_in": number, "count": number, "confidence": "HIGH|MEDIUM|LOW"}],
    "chimneys": [{"width_ft": number, "length_ft": number, "flashing_perimeter_ft": number, "confidence": "HIGH|MEDIUM|LOW"}],
    "skylights": [{"width_ft": number, "length_ft": number, "flashing_perimeter_ft": number, "confidence": "HIGH|MEDIUM|LOW"}]
  }`;

function buildPrompt(width: number, length: number, area: number, segmentCount: number): string {
  return `You are a professional roof measurement analyst. Analyze these images of a residential building.

KNOWN REFERENCE DIMENSIONS (from satellite data):
- Building footprint: approximately ${width.toFixed(1)}ft x ${length.toFixed(1)}ft
- Total roof area: ${area.toFixed(0)} sq ft (verified by satellite)
- Number of roof segments/facets: ${segmentCount}

Using these known dimensions as your measurement reference scale, estimate the following linear measurements in feet:

1. RIDGE LENGTH(S): The horizontal line(s) at the peak where two roof slopes meet. List each ridge separately if multiple.
2. RAKE LENGTH(S): The sloped edges of the roof from ridge to eave along the gable ends. List each.
3. VALLEY LENGTH(S): Where two downward roof slopes meet forming a V. List each. If none, say "None".
4. EAVE LENGTH(S): The horizontal bottom edges of the roof. List each side.
5. HIP LENGTH(S): Where two upward roof slopes meet forming an inverted V. List each. If none, say "None".
6. PITCH ESTIMATE(S): Estimate the roof pitch in X/12 format for each visible slope.
${COMPONENTS_PROMPT_SECTION}

For each measurement, provide:
- Your estimate in feet (or X/12 for pitch)
- Your confidence: HIGH, MEDIUM, or LOW

Respond in this exact JSON format:
{
  "ridges": [{"length_ft": number, "confidence": "HIGH|MEDIUM|LOW"}],
  "rakes": [{"length_ft": number, "confidence": "HIGH|MEDIUM|LOW"}],
  "valleys": [{"length_ft": number, "confidence": "HIGH|MEDIUM|LOW"}],
  "eaves": [{"length_ft": number, "confidence": "HIGH|MEDIUM|LOW"}],
  "hips": [{"length_ft": number, "confidence": "HIGH|MEDIUM|LOW"}],
  "pitches": [{"pitch": "X/12", "confidence": "HIGH|MEDIUM|LOW"}],
  "total_ridge_ft": number,
  "total_rake_ft": number,
  "total_valley_ft": number,
  "total_eave_ft": number,
  "total_hip_ft": number,
  "primary_pitch": "X/12",
  "roof_style": "gable|hip|flat|mansard|gambrel|combination",
  "notes": "string with any observations",
${COMPONENTS_JSON_FORMAT}
}`;
}

function buildEnhancedPrompt(
  width: number, length: number,
  previousMeasurements: object,
  photoLabels: string[]
): string {
  return `You previously estimated these roof measurements from satellite imagery:
${JSON.stringify(previousMeasurements, null, 2)}

Now analyze these additional photos taken at the property. Use them to VERIFY and REFINE your measurements.

Photos provided: ${photoLabels.join(', ')}

Known reference: The building footprint is approximately ${width.toFixed(1)}ft x ${length.toFixed(1)}ft.

For each measurement, provide your REFINED estimate considering both satellite data and these closer photos.
If a photo clearly shows a measurement that contradicts the satellite estimate, prefer the photo-based measurement.

Also identify all roof components and penetrations visible in these closer photos:
${COMPONENTS_PROMPT_SECTION}

Respond in this exact JSON format (same as before, but add refinement_notes):
{
  "ridges": [{"length_ft": number, "confidence": "HIGH|MEDIUM|LOW"}],
  "rakes": [{"length_ft": number, "confidence": "HIGH|MEDIUM|LOW"}],
  "valleys": [{"length_ft": number, "confidence": "HIGH|MEDIUM|LOW"}],
  "eaves": [{"length_ft": number, "confidence": "HIGH|MEDIUM|LOW"}],
  "hips": [{"length_ft": number, "confidence": "HIGH|MEDIUM|LOW"}],
  "pitches": [{"pitch": "X/12", "confidence": "HIGH|MEDIUM|LOW"}],
  "total_ridge_ft": number,
  "total_rake_ft": number,
  "total_valley_ft": number,
  "total_eave_ft": number,
  "total_hip_ft": number,
  "primary_pitch": "X/12",
  "roof_style": "gable|hip|flat|mansard|gambrel|combination",
  "notes": "string with any observations",
  "refinement_notes": "string explaining what changed from the satellite estimate and why",
${COMPONENTS_JSON_FORMAT}
}`;
}

function parseAIJson(text: string): AIMeasurements | null {
  // Strip markdown code fences if present
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  // Fix Python-style None/True/False → JSON null/true/false
  cleaned = cleaned.replace(/\bNone\b/g, 'null').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false');

  // Try direct parse
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.ridges || parsed.total_ridge_ft != null) return parsed;
  } catch { /* fall through */ }

  // Try extracting JSON object
  try {
    const match = cleaned.match(/\{[\s\S]*"ridges"[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.ridges || parsed.total_ridge_ft != null) return parsed;
    }
  } catch { /* fall through */ }

  // Try fixing common LLM JSON errors
  try {
    let fixed = cleaned;
    // Extract just the JSON part
    const jsonStart = fixed.indexOf('{');
    const jsonEnd = fixed.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      fixed = fixed.slice(jsonStart, jsonEnd + 1);
    }
    // Fix trailing commas before ] or }
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');
    // Fix missing commas between } and "
    fixed = fixed.replace(/\}(\s*")/g, '},$1');
    // Fix missing ] before , "next_key"
    fixed = fixed.replace(/("confidence":\s*"[A-Z]+")\s*},?\s*"(rakes|valleys|eaves|hips|ridges|pitches)/g, '$1}],"$2');
    // Try balanced brace extraction
    let depth = 0; let start = -1; let end = -1;
    for (let i = 0; i < fixed.length; i++) {
      if (fixed[i] === '{') { if (depth === 0) start = i; depth++; }
      if (fixed[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (start >= 0 && end > start) {
      fixed = fixed.slice(start, end + 1);
    }
    const parsed = JSON.parse(fixed);
    if (parsed.ridges || parsed.total_ridge_ft != null) {
      return parsed;
    }
  } catch { /* fall through */ }

  // Last resort: try to extract individual measurements with regex
  try {
    const getTotal = (key: string) => {
      const m = cleaned.match(new RegExp(`"total_${key}_ft"\\s*:\\s*([\\d.]+)`));
      return m ? parseFloat(m[1]) : 0;
    };
    const getItems = (key: string) => {
      const section = cleaned.match(new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*?)\\]`, 's'));
      if (!section) return [];
      const items: { length_ft: number; confidence: string }[] = [];
      const itemRe = /"length_ft"\s*:\s*([\d.]+)[^}]*?"confidence"\s*:\s*"(\w+)"/g;
      let im;
      while ((im = itemRe.exec(section[1])) !== null) {
        items.push({ length_ft: parseFloat(im[1]), confidence: im[2] });
      }
      return items;
    };
    const result: Record<string, unknown> = {
      ridges: getItems('ridges'), rakes: getItems('rakes'), valleys: getItems('valleys'),
      eaves: getItems('eaves'), hips: getItems('hips'), pitches: getItems('pitches'),
      total_ridge_ft: getTotal('ridge'), total_rake_ft: getTotal('rake'),
      total_valley_ft: getTotal('valley'), total_eave_ft: getTotal('eave'), total_hip_ft: getTotal('hip'),
    };
    // Extract other fields
    const pitchMatch = cleaned.match(/"primary_pitch"\s*:\s*"([^"]+)"/);
    const styleMatch = cleaned.match(/"roof_style"\s*:\s*"([^"]+)"/);
    if (pitchMatch) result.primary_pitch = pitchMatch[1];
    if (styleMatch) result.roof_style = styleMatch[1];
    result.notes = '';
    // Only return if we got at least some data
    const hasData = (result.total_ridge_ft as number) > 0 || (result.total_rake_ft as number) > 0 || (result.total_eave_ft as number) > 0;
    if (hasData) {
      return result as unknown as AIMeasurements;
    }
  } catch { /* fall through */ }

  return null;
}

function emptyComponents(): RoofComponents {
  return { flashing: [], transitions: [], vents: [], pipes: [], chimneys: [], skylights: [] };
}

// ── AI Providers ───────────────────────────────────────────────────────────

async function callGemini(prompt: string, images: string[]): Promise<AIResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { status: 'skipped', measurements: null, raw: 'GEMINI_API_KEY not configured' };
  try {
    const parts: object[] = [{ text: prompt }];
    for (const img of images) {
      parts.push({ inlineData: { mimeType: 'image/png', data: img } });
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );
    if (!res.ok) {
      const errBody = await res.text();
      return { status: 'error', measurements: null, raw: `Gemini HTTP ${res.status}: ${errBody.slice(0, 500)}` };
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const measurements = parseAIJson(text);
    return { status: measurements ? 'success' : 'parse_error', measurements, raw: text.slice(0, 2000) };
  } catch (e: unknown) {
    return { status: 'error', measurements: null, raw: String(e) };
  }
}

async function callGeminiVerify(prompt: string, images: string[]): Promise<AIResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { status: 'skipped', measurements: null, raw: 'GEMINI_API_KEY not configured' };
  try {
    // Use a verification-focused system instruction for the second pass
    const verifyPrompt = `You are a SECOND INDEPENDENT roof measurement analyst providing a verification pass.
Be extra conservative and precise. Double-check all estimates against the known reference dimensions.
If something looks uncertain, round DOWN rather than up. Focus on accuracy over completeness.

${prompt}`;

    const parts: object[] = [{ text: verifyPrompt }];
    for (const img of images) {
      parts.push({ inlineData: { mimeType: 'image/png', data: img } });
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
        }),
      }
    );
    if (!res.ok) {
      const errBody = await res.text();
      return { status: 'error', measurements: null, raw: `Gemini-Verify HTTP ${res.status}: ${errBody.slice(0, 500)}` };
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const measurements = parseAIJson(text);
    return { status: measurements ? 'success' : 'parse_error', measurements, raw: text.slice(0, 2000) };
  } catch (e: unknown) {
    return { status: 'error', measurements: null, raw: String(e) };
  }
}

async function callOllama(prompt: string, images: string[]): Promise<AIResult> {
  try {
    const jsonPrompt = prompt + '\n\nRespond ONLY with valid JSON. No markdown, no explanation, just the JSON object.';
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llava:7b',
        prompt: jsonPrompt,
        images,
        stream: false,
      }),
      signal: AbortSignal.timeout(600000), // 10 min — Ollama on CPU is slow but works
    });
    if (!res.ok) return { status: 'error', measurements: null, raw: `Ollama returned ${res.status}` };
    const data = await res.json();
    const text = data?.response || '';
    const measurements = parseAIJson(text);
    return { status: measurements ? 'success' : 'parse_error', measurements, raw: text.slice(0, 2000) };
  } catch (e: unknown) {
    return { status: 'error', measurements: null, raw: String(e) };
  }
}

// ── Consensus Builder ──────────────────────────────────────────────────────

type MeasKey = 'total_ridge_ft' | 'total_rake_ft' | 'total_valley_ft' | 'total_eave_ft' | 'total_hip_ft';
type ConsensusKey = 'ridges' | 'rakes' | 'valleys' | 'eaves' | 'hips';

function calcVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const min = Math.min(...values);
  if (min === 0) return values.some(v => v > 0) ? 1 : 0;
  const max = Math.max(...values);
  return (max - min) / min;
}

function dropOutliersAndAverage(values: { name: string; val: number }[], dropCount: number): { avg: number; kept: { name: string; val: number }[] } {
  if (values.length <= dropCount) return { avg: values.reduce((s, v) => s + v.val, 0) / values.length, kept: values };
  const mean = values.reduce((s, v) => s + v.val, 0) / values.length;
  const sorted = [...values].sort((a, b) => Math.abs(b.val - mean) - Math.abs(a.val - mean));
  const kept = sorted.slice(dropCount);
  return { avg: kept.reduce((s, v) => s + v.val, 0) / kept.length, kept };
}

interface PerMeasConsensus {
  totalFt: number;
  count: number;
  details: { lengthFt: number }[];
  confidence: string;
  rerunPerformed: boolean;
}

async function buildMeasurementConsensus(
  mk: { total: MeasKey; detail: ConsensusKey },
  results: { name: string; m: AIMeasurements }[],
  allImages: string[],
  prompt: string,
  notes: string[],
): Promise<PerMeasConsensus> {
  const vals = results.map(r => ({ name: r.name, val: r.m[mk.total] || 0, details: r.m[mk.detail] || [] }));
  const nonZero = vals.filter(v => v.val > 0);

  if (nonZero.length === 0) {
    return { totalFt: 0, count: 0, details: [], confidence: 'N/A', rerunPerformed: false };
  }

  if (nonZero.length === 1) {
    notes.push(`${mk.detail}: only ${nonZero[0].name} provided data`);
    const details = nonZero[0].details.map((d: { length_ft: number }) => ({ lengthFt: d.length_ft }));
    return { totalFt: nonZero[0].val, count: details.length, details, confidence: 'LOW', rerunPerformed: false };
  }

  const variance = calcVariance(nonZero.map(v => v.val));

  // < 10% variance → HIGH, average all
  if (variance <= 0.10) {
    const totalFt = nonZero.reduce((s, v) => s + v.val, 0) / nonZero.length;
    const closest = nonZero.reduce((best, v) => Math.abs(v.val - totalFt) < Math.abs(best.val - totalFt) ? v : best);
    const details = closest.details.map((d: { length_ft: number }) => ({ lengthFt: d.length_ft }));
    return { totalFt: Math.round(totalFt * 10) / 10, count: details.length, details, confidence: 'HIGH', rerunPerformed: false };
  }

  // Need re-run: 10-20% or >20%
  const minConfidence = variance > 0.20 ? 'LOW' : 'MEDIUM';
  let rerunPerformed = false;

  // Re-run through Gemini + GeminiVerify
  const rerunResults: { name: string; val: number; details: object[] }[] = [...nonZero.map(v => ({ name: v.name, val: v.val, details: v.details }))];

  try {
    const [gemRerun, gvRerun] = await Promise.all([
      callGemini(prompt, allImages),
      callGeminiVerify(prompt, allImages),
    ]);
    if (gemRerun.measurements) {
      rerunResults.push({ name: 'Gemini-rerun', val: gemRerun.measurements[mk.total] || 0, details: gemRerun.measurements[mk.detail] || [] });
    }
    if (gvRerun.measurements) {
      rerunResults.push({ name: 'GeminiVerify-rerun', val: gvRerun.measurements[mk.total] || 0, details: gvRerun.measurements[mk.detail] || [] });
    }
    rerunPerformed = true;
  } catch {
    // Re-run failed, proceed with original results
  }

  const nonZeroRerun = rerunResults.filter(v => v.val > 0);

  // Drop 2 biggest outliers, average remaining 3
  const { avg, kept } = dropOutliersAndAverage(nonZeroRerun, 2);
  const keptVariance = calcVariance(kept.map(v => v.val));

  let confidence: string;
  if (minConfidence === 'LOW') {
    confidence = keptVariance <= 0.10 ? 'LOW' : keptVariance <= 0.20 ? 'LOW' : 'LOW';
    // >20% first pass always LOW minimum
  } else {
    confidence = keptVariance <= 0.10 ? 'HIGH' : keptVariance <= 0.20 ? 'MEDIUM' : 'LOW';
  }

  if (keptVariance > 0.20) {
    notes.push(`${mk.detail}: flagged for manual review (${(keptVariance * 100).toFixed(0)}% variance after re-run)`);
  } else if (rerunPerformed) {
    notes.push(`${mk.detail}: re-run performed, final variance ${(keptVariance * 100).toFixed(0)}%`);
  }

  const closest = nonZeroRerun.reduce((best, v) => Math.abs(v.val - avg) < Math.abs(best.val - avg) ? v : best);
  const details = closest.details.map((d: { length_ft?: number }) => ({ lengthFt: d.length_ft || 0 }));

  return { totalFt: Math.round(avg * 10) / 10, count: details.length, details, confidence, rerunPerformed };
}

function buildComponentConsensus(results: { name: string; m: AIMeasurements }[]): RoofComponents {
  const allComps = results.map(r => r.m.components || emptyComponents());

  // Merge flashing: combine all, group by type, average lengths
  const flashingByType = new Map<string, { lengths: number[]; confidences: string[] }>();
  for (const c of allComps) {
    for (const f of c.flashing) {
      const entry = flashingByType.get(f.type) || { lengths: [], confidences: [] };
      entry.lengths.push(f.length_ft);
      entry.confidences.push(f.confidence);
      flashingByType.set(f.type, entry);
    }
  }
  const flashing: FlashingItem[] = Array.from(flashingByType.entries()).map(([type, data]) => ({
    type,
    length_ft: Math.round(data.lengths.reduce((s, v) => s + v, 0) / data.lengths.length * 10) / 10,
    confidence: pickConsensusConfidence(data.confidences),
  }));

  // Transitions: average lengths
  const allTransitions = allComps.flatMap(c => c.transitions);
  const transitions: TransitionItem[] = allTransitions.length > 0 ? [{
    length_ft: Math.round(allTransitions.reduce((s, t) => s + t.length_ft, 0) / allTransitions.length * 10) / 10,
    description: allTransitions[0]?.description || 'Roof plane transition',
    confidence: pickConsensusConfidence(allTransitions.map(t => t.confidence)),
  }] : [];

  // Vents: group by type, average counts
  const ventsByType = new Map<string, { counts: number[]; confidences: string[] }>();
  for (const c of allComps) {
    for (const v of c.vents) {
      const entry = ventsByType.get(v.type) || { counts: [], confidences: [] };
      entry.counts.push(v.count);
      entry.confidences.push(v.confidence);
      ventsByType.set(v.type, entry);
    }
  }
  const vents: VentItem[] = Array.from(ventsByType.entries()).map(([type, data]) => ({
    type,
    count: Math.round(data.counts.reduce((s, v) => s + v, 0) / data.counts.length),
    confidence: pickConsensusConfidence(data.confidences),
  }));

  // Pipes: group by diameter, average counts
  const pipesByDiam = new Map<number, { counts: number[]; confidences: string[] }>();
  for (const c of allComps) {
    for (const p of c.pipes) {
      const diam = Math.round(p.diameter_in);
      const entry = pipesByDiam.get(diam) || { counts: [], confidences: [] };
      entry.counts.push(p.count);
      entry.confidences.push(p.confidence);
      pipesByDiam.set(diam, entry);
    }
  }
  const pipes: PipeItem[] = Array.from(pipesByDiam.entries()).map(([diameter_in, data]) => ({
    diameter_in,
    count: Math.round(data.counts.reduce((s, v) => s + v, 0) / data.counts.length),
    confidence: pickConsensusConfidence(data.confidences),
  }));

  // Chimneys: average across all
  const allChimneys = allComps.flatMap(c => c.chimneys);
  const chimneys: ChimneyItem[] = allChimneys.length > 0 ? [{
    width_ft: Math.round(allChimneys.reduce((s, c) => s + c.width_ft, 0) / allChimneys.length * 10) / 10,
    length_ft: Math.round(allChimneys.reduce((s, c) => s + c.length_ft, 0) / allChimneys.length * 10) / 10,
    flashing_perimeter_ft: Math.round(allChimneys.reduce((s, c) => s + c.flashing_perimeter_ft, 0) / allChimneys.length * 10) / 10,
    confidence: pickConsensusConfidence(allChimneys.map(c => c.confidence)),
  }] : [];

  // Skylights: average across all
  const allSkylights = allComps.flatMap(c => c.skylights);
  const skylights: SkylightItem[] = allSkylights.length > 0 ? [{
    width_ft: Math.round(allSkylights.reduce((s, c) => s + c.width_ft, 0) / allSkylights.length * 10) / 10,
    length_ft: Math.round(allSkylights.reduce((s, c) => s + c.length_ft, 0) / allSkylights.length * 10) / 10,
    flashing_perimeter_ft: Math.round(allSkylights.reduce((s, c) => s + c.flashing_perimeter_ft, 0) / allSkylights.length * 10) / 10,
    confidence: pickConsensusConfidence(allSkylights.map(c => c.confidence)),
  }] : [];

  return { flashing, transitions, vents, pipes, chimneys, skylights };
}

function pickConsensusConfidence(confidences: string[]): string {
  if (confidences.length === 0) return 'LOW';
  const high = confidences.filter(c => c === 'HIGH').length;
  const low = confidences.filter(c => c === 'LOW').length;
  if (high > confidences.length / 2) return 'HIGH';
  if (low > confidences.length / 2) return 'LOW';
  return 'MEDIUM';
}

async function buildConsensus(
  results: { name: string; m: AIMeasurements }[],
  allImages: string[],
  prompt: string,
) {
  const measKeys: { total: MeasKey; detail: ConsensusKey }[] = [
    { total: 'total_ridge_ft', detail: 'ridges' },
    { total: 'total_rake_ft', detail: 'rakes' },
    { total: 'total_valley_ft', detail: 'valleys' },
    { total: 'total_eave_ft', detail: 'eaves' },
    { total: 'total_hip_ft', detail: 'hips' },
  ];

  const notes: string[] = [];
  const consensus: Record<string, PerMeasConsensus> = {};
  let anyRerun = false;

  // Process each measurement type independently
  for (const mk of measKeys) {
    const result = await buildMeasurementConsensus(mk, results, allImages, prompt, notes);
    consensus[mk.detail] = result;
    if (result.rerunPerformed) anyRerun = true;
  }

  // Build component consensus
  const components = buildComponentConsensus(results);

  const allPitches = results.map(r => r.m.primary_pitch).filter(Boolean);
  const primaryPitch = allPitches[0] || 'Unknown';

  const styles = results.map(r => r.m.roof_style).filter(Boolean);
  const roofStyle = styles.sort((a, b) => styles.filter(s => s === b).length - styles.filter(s => s === a).length)[0] || 'unknown';

  const perimeterFt = (consensus.eaves?.totalFt || 0) + (consensus.rakes?.totalFt || 0);

  const pitchDetails = results.flatMap(r => (r.m.pitches || []).map(p => ({ pitch: p.pitch, segmentArea: 0 })));
  const uniquePitches = Array.from(new Map(pitchDetails.map(p => [p.pitch, p])).values());

  const confs = Object.values(consensus).map(c => c.confidence).filter(c => c !== 'N/A');
  const overallConfidence = confs.every(c => c === 'HIGH') ? 'HIGH'
    : confs.some(c => c === 'LOW') ? 'LOW' : 'MEDIUM';

  return {
    measurements: {
      ridges: consensus.ridges,
      rakes: consensus.rakes,
      valleys: consensus.valleys,
      eaves: consensus.eaves,
      hips: consensus.hips,
      pitches: { primary: primaryPitch, all: uniquePitches, confidence: allPitches.length >= 2 ? 'MEDIUM' : 'LOW' },
      roofStyle,
      perimeterFt: Math.round(perimeterFt * 10) / 10,
    },
    components,
    overallConfidence,
    qualityNotes: notes,
    rerunPerformed: anyRerun,
  };
}

// ── Core analysis (shared by GET and POST) ─────────────────────────────────

async function runSatelliteAnalysis(address: string) {
  const geo = await geocode(address);
  const solar = await getSolarData(geo.lat, geo.lng);
  const solarSegments = solar?.solarPotential?.roofSegmentStats || [];
  const wholeRoof = solar?.solarPotential?.wholeRoofStats;
  const totalAreaSqFt = wholeRoof?.areaMeters2 ? wholeRoof.areaMeters2 * 10.7639 : 0;
  const boundingBox = solar?.solarPotential?.boundingBox || solar?.boundingBox;

  // Satellite: primary overhead + slightly offset for different perspective
  const satUrls = [
    // Direct overhead zoom 20
    `https://maps.googleapis.com/maps/api/staticmap?center=${geo.lat},${geo.lng}&zoom=20&size=640x640&maptype=satellite&key=${GOOGLE_KEY}`,
    // Wider context zoom 19 — shows property boundaries, neighbors
    `https://maps.googleapis.com/maps/api/staticmap?center=${geo.lat},${geo.lng}&zoom=19&size=640x640&maptype=satellite&key=${GOOGLE_KEY}`,
    // Slight offset north — different capture angle/date potentially
    `https://maps.googleapis.com/maps/api/staticmap?center=${geo.lat + 0.00015},${geo.lng}&zoom=20&size=640x640&maptype=satellite&key=${GOOGLE_KEY}`,
  ];
  const satImages = await Promise.all(satUrls.map(url => fetchImageBase64(url)));
  const validSatImages = satImages.filter((img): img is string => img !== null);
  const satBase64 = validSatImages[0]; // Primary for display

  // Street view: 4 cardinal directions + 2 elevated pitches for roof visibility
  const svConfigs = [
    { heading: 0, pitch: 30, fov: 90 },    // North, looking up at roof
    { heading: 90, pitch: 30, fov: 90 },   // East
    { heading: 180, pitch: 30, fov: 90 },  // South
    { heading: 270, pitch: 30, fov: 90 },  // West
  ];
  const svImages: (string | null)[] = await Promise.all(
    svConfigs.map(({ heading, pitch, fov }) => {
      const url = `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${geo.lat},${geo.lng}&heading=${heading}&pitch=${pitch}&fov=${fov}&key=${GOOGLE_KEY}`;
      return fetchImageBase64(url);
    })
  );
  const validSvImages = svImages.filter((img): img is string => img !== null);
  let buildingWidth = 40, buildingLength = 40;
  if (boundingBox) {
    const ne = boundingBox.ne || boundingBox.high;
    const sw = boundingBox.sw || boundingBox.low;
    if (ne && sw) {
      buildingLength = Math.abs(ne.latitude - sw.latitude) * 364000;
      buildingWidth = Math.abs(ne.longitude - sw.longitude) * 288200 * Math.cos(geo.lat * Math.PI / 180);
    }
  }

  const prompt = buildPrompt(buildingWidth, buildingLength, totalAreaSqFt, solarSegments.length);
  const allImages = [...validSatImages, ...validSvImages].filter((img): img is string => img !== null);

  if (allImages.length === 0) {
    throw new Error('Could not retrieve any imagery for this address');
  }

  // Race: proceed as soon as we have at least 1 success, with 60s deadline for stragglers
  const ollamaImages = validSatImages.slice(0, 2); // Ollama gets 2 satellite zooms
  const geminiP = callGemini(prompt, allImages).then(r => r);
  const geminiVerifyP = callGeminiVerify(prompt, allImages).then(r => r);
  const ollamaP = callOllama(prompt, ollamaImages).then(r => r);

  // Wait for all providers — Ollama can take minutes on CPU, that's fine
  const settled = await Promise.allSettled([geminiP, geminiVerifyP, ollamaP]);
  const results = settled.map(s => s.status === 'fulfilled' ? s.value : { status: 'error', measurements: null, raw: 'rejected' } as AIResult);
  const geminiResult = results[0];
  const geminiVerifyResult = results[1];
  const ollamaResult = results[2];

  const successfulResults: { name: string; m: AIMeasurements }[] = [];
  if (geminiResult.measurements) successfulResults.push({ name: 'Gemini', m: geminiResult.measurements });
  if (geminiVerifyResult.measurements) successfulResults.push({ name: 'GeminiVerify', m: geminiVerifyResult.measurements });
  if (ollamaResult.measurements) successfulResults.push({ name: 'Ollama', m: ollamaResult.measurements });

  const qualityNotes: string[] = [];
  if (geminiResult.status !== 'success') qualityNotes.push(`Gemini: ${geminiResult.status}`);
  if (geminiVerifyResult.status !== 'success') qualityNotes.push(`GeminiVerify: ${geminiVerifyResult.status}`);
  if (ollamaResult.status !== 'success') qualityNotes.push(`Ollama: ${ollamaResult.status}`);
  if (validSvImages.length < 3) qualityNotes.push(`Only ${validSvImages.length}/3 street view angles available`);
  if (!solar) qualityNotes.push('Solar API data unavailable - measurements may be less accurate');

  if (successfulResults.length === 0) {
    const details = [
      `Gemini: ${geminiResult.raw?.slice(0, 150) || geminiResult.status}`,
      `GeminiVerify: ${geminiVerifyResult.raw?.slice(0, 150) || geminiVerifyResult.status}`,
      `Ollama: ${ollamaResult.raw?.slice(0, 150) || ollamaResult.status}`,
    ].join(' | ');
    throw new Error(`All AI providers failed — ${details}`);
  }

  // Cross-validate against Solar API geometric data
  if (solar && totalAreaSqFt > 0) {
    // Solar API gives us area; we can sanity-check perimeter estimates
    const sqrtArea = Math.sqrt(totalAreaSqFt);
    // Rough expected perimeter for a rectangular roof
    const expectedPerimeter = sqrtArea * 4 * 0.9; // rough lower bound
    qualityNotes.push(`Solar cross-validation: roof area ${Math.round(totalAreaSqFt)} sq ft, ${solarSegments.length} segments`);
  }

  const consensusResult = await buildConsensus(successfulResults, allImages, prompt);
  qualityNotes.push(...consensusResult.qualityNotes);

  const segments = solarSegments.map((seg: { pitchDegrees?: number; azimuthDegrees?: number; stats?: { areaMeters2?: number } }) => ({
    pitchDegrees: seg.pitchDegrees || 0,
    azimuthDegrees: seg.azimuthDegrees || 0,
    areaSqFt: (seg.stats?.areaMeters2 || 0) * 10.7639,
    direction: azimuthToDirection(seg.azimuthDegrees || 0),
  }));

  return {
    geo,
    solar,
    satBase64,
    validSatImages,
    validSvImages,
    buildingWidth,
    buildingLength,
    totalAreaSqFt,
    solarSegments,
    segments,
    measurements: consensusResult.measurements,
    components: consensusResult.components,
    overallConfidence: consensusResult.overallConfidence,
    rerunPerformed: consensusResult.rerunPerformed,
    qualityNotes,
    aiResults: {
      gemini: { status: geminiResult.status, measurements: geminiResult.measurements, raw: geminiResult.raw },
      geminiVerify: { status: geminiVerifyResult.status, measurements: geminiVerifyResult.measurements, raw: geminiVerifyResult.raw },
      ollama: { status: ollamaResult.status, measurements: ollamaResult.measurements, raw: ollamaResult.raw },
    },
  };
}

async function runPhotoEnhancement(
  satBase64: string | null,
  photoImages: string[],
  photoLabels: string[],
  buildingWidth: number,
  buildingLength: number,
  satelliteMeasurements: object,
) {
  const enhancedPrompt = buildEnhancedPrompt(buildingWidth, buildingLength, satelliteMeasurements, photoLabels);
  const allImages = [satBase64, ...photoImages].filter((img): img is string => img !== null);

  const [geminiResult, geminiVerifyResult, ollamaResult] = await Promise.all([
    callGemini(enhancedPrompt, allImages),
    callGeminiVerify(enhancedPrompt, allImages),
    callOllama(enhancedPrompt, allImages),
  ]);

  const successfulResults: { name: string; m: AIMeasurements }[] = [];
  if (geminiResult.measurements) successfulResults.push({ name: 'Gemini', m: geminiResult.measurements });
  if (geminiVerifyResult.measurements) successfulResults.push({ name: 'GeminiVerify', m: geminiVerifyResult.measurements });
  if (ollamaResult.measurements) successfulResults.push({ name: 'Ollama', m: ollamaResult.measurements });

  const qualityNotes: string[] = [];
  if (geminiResult.status !== 'success') qualityNotes.push(`Photo-Gemini: ${geminiResult.status}`);
  if (geminiVerifyResult.status !== 'success') qualityNotes.push(`Photo-GeminiVerify: ${geminiVerifyResult.status}`);
  if (ollamaResult.status !== 'success') qualityNotes.push(`Photo-Ollama: ${ollamaResult.status}`);

  if (successfulResults.length === 0) {
    return null;
  }

  const consensusResult = await buildConsensus(successfulResults, allImages, enhancedPrompt);
  qualityNotes.push(...consensusResult.qualityNotes);

  const refinementNotes = successfulResults
    .map(r => r.m.refinement_notes)
    .filter(Boolean)
    .join(' | ');

  return {
    measurements: consensusResult.measurements,
    components: consensusResult.components,
    overallConfidence: consensusResult.overallConfidence,
    rerunPerformed: consensusResult.rerunPerformed,
    qualityNotes,
    refinementNotes,
    aiResults: {
      gemini: { status: geminiResult.status, measurements: geminiResult.measurements, raw: geminiResult.raw },
      geminiVerify: { status: geminiVerifyResult.status, measurements: geminiVerifyResult.measurements, raw: geminiVerifyResult.raw },
      ollama: { status: ollamaResult.status, measurements: ollamaResult.measurements, raw: ollamaResult.raw },
    },
  };
}

function buildResponse(
  sat: Awaited<ReturnType<typeof runSatelliteAnalysis>>,
  enhanced: Awaited<ReturnType<typeof runPhotoEnhancement>> | null,
  photoCount: number,
) {
  const response: Record<string, unknown> = {
    address: sat.geo.formatted,
    lat: sat.geo.lat,
    lng: sat.geo.lng,
    generatedAt: new Date().toISOString(),
    imageryDate: sat.solar?.imageryDate?.year
      ? `${sat.solar.imageryDate.year}-${String(sat.solar.imageryDate.month).padStart(2, '0')}-${String(sat.solar.imageryDate.day).padStart(2, '0')}`
      : 'Unknown',
    solarData: {
      totalRoofAreaSqFt: Math.round(sat.totalAreaSqFt),
      groundFootprintSqFt: Math.round(sat.buildingWidth * sat.buildingLength),
      segmentCount: sat.solarSegments.length,
      segments: sat.segments,
    },
    satelliteMeasurements: sat.measurements,
    satelliteConfidence: sat.overallConfidence,
    satelliteAiResults: sat.aiResults,
    satelliteComponents: sat.components,
    measurements: enhanced ? enhanced.measurements : sat.measurements,
    overallConfidence: enhanced ? enhanced.overallConfidence : sat.overallConfidence,
    aiResults: enhanced ? enhanced.aiResults : sat.aiResults,
    components: enhanced ? enhanced.components : sat.components,
    rerunPerformed: (sat.rerunPerformed || (enhanced?.rerunPerformed ?? false)),
    qualityNotes: [
      ...sat.qualityNotes,
      ...(enhanced?.qualityNotes || []),
    ],
    images: {
      satellite: sat.satBase64 ? `data:image/png;base64,${sat.satBase64}` : '',
      satelliteZooms: (sat.validSatImages || []).map((img: string) => `data:image/png;base64,${img}`),
      streetView: sat.validSvImages.map((img: string) => `data:image/png;base64,${img}`),
    },
    mode: enhanced ? 'enhanced' : 'satellite',
    photoCount,
  };

  if (enhanced) {
    response.enhancedMeasurements = enhanced.measurements;
    response.enhancedConfidence = enhanced.overallConfidence;
    response.enhancedAiResults = enhanced.aiResults;
    response.enhancedComponents = enhanced.components;
    response.refinementNotes = enhanced.refinementNotes;
  }

  return response;
}

// ── GET Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Public endpoint — no auth required (customer-facing roof measurement tool)
  const address = request.nextUrl.searchParams.get('address');
  if (!address) return NextResponse.json({ error: 'address parameter required' }, { status: 400 });
  if (!GOOGLE_KEY) return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });

  try {
    const sat = await runSatelliteAnalysis(address);
    return NextResponse.json(buildResponse(sat, null, 0));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ── POST Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Public endpoint — no auth required (customer-facing roof measurement tool)
  if (!GOOGLE_KEY) return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });

  try {
    const formData = await request.formData();
    const address = formData.get('address') as string;
    if (!address) return NextResponse.json({ error: 'address parameter required' }, { status: 400 });

    const mode = (formData.get('mode') as string) || 'satellite';
    const photoLabelsRaw = formData.get('photoLabels') as string;
    const photoLabels: string[] = photoLabelsRaw ? JSON.parse(photoLabelsRaw) : [];

    const photoImages: string[] = [];
    const photoFiles = formData.getAll('photos') as File[];
    for (const file of photoFiles) {
      try {
        if (file.size > 10 * 1024 * 1024) continue;
        const buf = Buffer.from(await file.arrayBuffer());
        photoImages.push(buf.toString('base64'));
      } catch {
        // Skip bad files
      }
    }

    const sat = await runSatelliteAnalysis(address);

    let enhanced: Awaited<ReturnType<typeof runPhotoEnhancement>> | null = null;
    if (mode === 'enhanced' && photoImages.length > 0) {
      enhanced = await runPhotoEnhancement(
        sat.satBase64,
        photoImages,
        photoLabels.length > 0 ? photoLabels : photoImages.map((_, i) => `Photo ${i + 1}`),
        sat.buildingWidth,
        sat.buildingLength,
        sat.measurements,
      );
    }

    return NextResponse.json(buildResponse(sat, enhanced, photoImages.length));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
