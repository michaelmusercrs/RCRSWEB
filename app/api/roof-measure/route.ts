import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300; // 5 min for local dev; Vercel Hobby caps at 60s automatically
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

interface RoofOutlineVertex { id: string; x: number; y: number; label?: string; }
interface RoofOutlineEdge { from: string; to: string; type: string; length_ft: number; label?: string; }
interface RoofOutlineSection { vertices: string[]; pitch: string; area_sqft: number; direction: string; label?: string; }
interface RoofOutline {
  vertices: RoofOutlineVertex[];
  edges: RoofOutlineEdge[];
  sections: RoofOutlineSection[];
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
  roof_outline?: RoofOutline;
}

interface AIResult {
  status: string;
  measurements: AIMeasurements | null;
  raw?: string;
}

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const IS_VERCEL = !!process.env.VERCEL;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// ── Vertex AI Auth (uses service account — paid, no free-tier quota limits) ──

async function getVertexAccessToken(): Promise<string | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const keyRaw = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !keyRaw) return null;

  try {
    const key = keyRaw.replace(/\\n/g, '\n');
    // Build JWT
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const claim = Buffer.from(JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');

    const crypto = require('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${claim}`);
    const signature = sign.sign(key, 'base64url');

    const jwt = `${header}.${claim}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch (e) {
    console.error('Vertex AI auth failed:', e);
    return null;
  }
}

let _vertexToken: string | null = null;
let _vertexTokenExpiry = 0;

async function getCachedVertexToken(): Promise<string | null> {
  if (_vertexToken && Date.now() < _vertexTokenExpiry) return _vertexToken;
  _vertexToken = await getVertexAccessToken();
  if (_vertexToken) _vertexTokenExpiry = Date.now() + 50 * 60 * 1000; // 50 min
  return _vertexToken;
}

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
  const lat = loc.lat as number;
  const lng = loc.lng as number;

  // Checkgate: Validate location is in North Alabama service area (roughly)
  // Expanded bounds: lat 33.5-35.5, lng -88.5 to -85.5
  if (lat < 33.5 || lat > 35.5 || lng < -88.5 || lng > -85.5) {
    // Still allow but flag it
    console.warn(`Geocoded location (${lat}, ${lng}) is outside North Alabama service area`);
  }

  return { lat, lng, formatted };
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

8. ROOF OUTLINE (OVERHEAD VIEW): Looking straight down at the roof from above, provide the outline as a series of vertices (x,y coordinates in feet, with origin at top-left corner of the building). Include ALL corners, gable peaks, hip points, and where roof planes meet the eaves. Also provide EDGES connecting these vertices, labeling each edge with its type (ridge, rake, valley, eave, hip) and its measured length.

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
  "roof_outline": {
    "vertices": [{"id": "V1", "x": number, "y": number, "label": "string (e.g. NW corner, gable peak, etc.)"}],
    "edges": [{"from": "V1", "to": "V2", "type": "ridge|rake|valley|eave|hip", "length_ft": number, "label": "string"}],
    "sections": [{"vertices": ["V1","V2","V3","V4"], "pitch": "X/12", "area_sqft": number, "direction": "N|NE|E|SE|S|SW|W|NW", "label": "string (e.g. Front slope, Garage wing, etc.)"}]
  },
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

// Models to try in order — different models have separate quotas on the free tier
const GEMINI_MODELS = [
  'gemini-2.5-flash-lite', // Separate quota pool
  'gemini-3-flash-preview',// Separate quota pool
  'gemini-2.5-flash',      // 10 RPM, 250 RPD free  
  'gemini-2.0-flash',      // 15 RPM, 1500 RPD free
];

async function callGeminiWithModel(model: string, key: string, prompt: string, images: string[], extraConfig?: object): Promise<AIResult> {
  try {
    const parts: object[] = [{ text: prompt }];
    for (const img of images) {
      parts.push({ inlineData: { mimeType: 'image/png', data: img } });
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: 'application/json', ...extraConfig },
        }),
      }
    );
    if (res.status === 429) {
      return { status: '429', measurements: null, raw: `${model} rate limited` };
    }
    if (!res.ok) {
      const errBody = await res.text();
      return { status: 'error', measurements: null, raw: `${model} HTTP ${res.status}: ${errBody.slice(0, 500)}` };
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const measurements = parseAIJson(text);
    return { status: measurements ? 'success' : 'parse_error', measurements, raw: text.slice(0, 2000) };
  } catch (e: unknown) {
    return { status: 'error', measurements: null, raw: `${model}: ${String(e)}` };
  }
}

async function callGeminiVertex(model: string, prompt: string, images: string[], extraConfig?: object): Promise<AIResult> {
  const token = await getCachedVertexToken();
  if (!token) return { status: 'skipped', measurements: null, raw: 'Vertex AI auth failed' };
  
  // Extract project ID from service account email
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const projectMatch = email.match(/@(.+)\.iam\.gserviceaccount\.com/);
  if (!projectMatch) return { status: 'skipped', measurements: null, raw: 'Cannot extract project ID' };
  const projectId = projectMatch[1];

  try {
    const parts: object[] = [{ text: prompt }];
    for (const img of images) {
      parts.push({ inlineData: { mimeType: 'image/png', data: img } });
    }
    const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', ...extraConfig },
      }),
    });
    if (res.status === 429) return { status: '429', measurements: null, raw: `Vertex ${model} rate limited` };
    if (!res.ok) {
      const errBody = await res.text();
      return { status: 'error', measurements: null, raw: `Vertex ${model} HTTP ${res.status}: ${errBody.slice(0, 500)}` };
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const measurements = parseAIJson(text);
    return { status: measurements ? 'success' : 'parse_error', measurements, raw: text.slice(0, 2000) };
  } catch (e: unknown) {
    return { status: 'error', measurements: null, raw: `Vertex ${model}: ${String(e)}` };
  }
}

async function callGemini(prompt: string, images: string[]): Promise<AIResult> {
  // 1. Try Vertex AI first (paid service account — no free-tier limits)
  for (const model of ['gemini-2.0-flash', 'gemini-2.5-flash']) {
    const result = await callGeminiVertex(model, prompt, images);
    if (result.status === 'success') { console.log(`Vertex AI ${model} succeeded`); return result; }
    if (result.status !== '429' && result.status !== 'skipped') { console.log(`Vertex AI ${model}: ${result.raw?.slice(0, 100)}`); }
  }
  
  // 2. Fall back to AI Studio API key
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { status: 'skipped', measurements: null, raw: 'No Gemini API available' };
  
  for (const model of GEMINI_MODELS) {
    const result = await callGeminiWithModel(model, key, prompt, images);
    if (result.status === 'success') return result;
    if (result.status !== '429') return result;
    console.log(`AI Studio ${model} hit 429, trying next...`);
  }
  return { status: 'error', measurements: null, raw: 'All Gemini endpoints rate limited' };
}

async function callGeminiVerify(prompt: string, images: string[]): Promise<AIResult> {
  const verifyPrompt = `You are a SECOND INDEPENDENT roof measurement analyst providing a verification pass.
Be extra conservative and precise. Double-check all estimates against the known reference dimensions.
If something looks uncertain, round DOWN rather than up. Focus on accuracy over completeness.

${prompt}`;

  // 1. Vertex AI first
  for (const model of ['gemini-2.0-flash', 'gemini-2.5-flash']) {
    const result = await callGeminiVertex(model, verifyPrompt, images, { temperature: 0.1 });
    if (result.status === 'success') return result;
  }
  
  // 2. AI Studio fallback
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { status: 'skipped', measurements: null, raw: 'No Gemini API available' };
  for (const model of GEMINI_MODELS) {
    const result = await callGeminiWithModel(model, key, verifyPrompt, images, { temperature: 0.1 });
    if (result.status === 'success') return result;
    if (result.status !== '429') return result;
  }
  return { status: 'error', measurements: null, raw: 'All Gemini endpoints rate limited for verify' };
}

async function callOllama(prompt: string, images: string[]): Promise<AIResult> {
  // Skip Ollama on Vercel — it's a localhost-only service
  if (IS_VERCEL) {
    return { status: 'skipped', measurements: null, raw: 'Ollama skipped on Vercel (localhost only)' };
  }
  try {
    const jsonPrompt = prompt + '\n\nRespond ONLY with valid JSON. No markdown, no explanation, just the JSON object.';
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
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

// ── Michael's Rule: 3 samples, drop the outlier, average the 2 closest ──
// No re-runs. The 3 passes already used different images & models.
// Just compare, drop the weird one, average the two that agree.
async function buildMeasurementConsensus(
  mk: { total: MeasKey; detail: ConsensusKey },
  results: { name: string; m: AIMeasurements }[],
  _allImages: string[],
  _prompt: string,
  notes: string[],
): Promise<PerMeasConsensus> {
  const vals = results.map(r => ({ name: r.name, val: r.m[mk.total] || 0, details: r.m[mk.detail] || [] }));
  const nonZero = vals.filter(v => v.val > 0);

  if (nonZero.length === 0) {
    return { totalFt: 0, count: 0, details: [], confidence: 'N/A', rerunPerformed: false };
  }

  if (nonZero.length === 1) {
    notes.push(`${mk.detail}: only ${nonZero[0].name} provided data — single source, verify on-site`);
    const details = nonZero[0].details.map((d: { length_ft: number }) => ({ lengthFt: d.length_ft }));
    return { totalFt: nonZero[0].val, count: details.length, details, confidence: 'LOW', rerunPerformed: false };
  }

  if (nonZero.length === 2) {
    // 2 results: average them, confidence based on how close they are
    const variance = calcVariance(nonZero.map(v => v.val));
    const avg = (nonZero[0].val + nonZero[1].val) / 2;
    const confidence = variance <= 0.10 ? 'HIGH' : variance <= 0.20 ? 'MEDIUM' : 'LOW';
    if (variance > 0.20) notes.push(`${mk.detail}: ${(variance * 100).toFixed(0)}% variance between 2 passes — verify on-site`);
    const closest = nonZero.reduce((best, v) => Math.abs(v.val - avg) < Math.abs(best.val - avg) ? v : best);
    const details = closest.details.map((d: { length_ft: number }) => ({ lengthFt: d.length_ft }));
    return { totalFt: Math.round(avg * 10) / 10, count: details.length, details, confidence, rerunPerformed: false };
  }

  // 3+ results: DROP THE OUTLIER, average the 2 closest
  // Find which pair of values is closest to each other
  let bestPair = [0, 1];
  let bestDiff = Infinity;
  for (let i = 0; i < nonZero.length; i++) {
    for (let j = i + 1; j < nonZero.length; j++) {
      const diff = Math.abs(nonZero[i].val - nonZero[j].val);
      if (diff < bestDiff) { bestDiff = diff; bestPair = [i, j]; }
    }
  }

  const kept = [nonZero[bestPair[0]], nonZero[bestPair[1]]];
  const dropped = nonZero.filter((_, idx) => !bestPair.includes(idx));
  const avg = (kept[0].val + kept[1].val) / 2;
  const keptVariance = calcVariance(kept.map(v => v.val));
  const confidence = keptVariance <= 0.10 ? 'HIGH' : keptVariance <= 0.20 ? 'MEDIUM' : 'LOW';

  if (dropped.length > 0) {
    const droppedNames = dropped.map(d => `${d.name}(${d.val.toFixed(1)}ft)`).join(', ');
    notes.push(`${mk.detail}: dropped outlier ${droppedNames}, kept ${kept[0].name}(${kept[0].val.toFixed(1)}ft) + ${kept[1].name}(${kept[1].val.toFixed(1)}ft) = ${avg.toFixed(1)}ft avg`);
  }

  if (keptVariance > 0.20) {
    notes.push(`${mk.detail}: even closest pair has ${(keptVariance * 100).toFixed(0)}% variance — verify on-site`);
  }

  const closest = kept.reduce((best, v) => Math.abs(v.val - avg) < Math.abs(best.val - avg) ? v : best);
  const details = closest.details.map((d: { length_ft?: number }) => ({ lengthFt: d.length_ft || 0 }));

  return { totalFt: Math.round(avg * 10) / 10, count: details.length, details, confidence, rerunPerformed: false };
}

// Michael's consensus: 3 samples → average all if within 10%.
// 5 samples → drop 2 outliers, average best 3, check 10% again.
function buildMeasurementConsensusSimple(
  mk: { total: MeasKey; detail: ConsensusKey },
  results: { name: string; m: AIMeasurements }[],
  notes: string[],
): PerMeasConsensus {
  const vals = results.map(r => ({ name: r.name, val: r.m[mk.total] || 0, details: r.m[mk.detail] || [] }));
  const nonZero = vals.filter(v => v.val > 0);

  if (nonZero.length === 0) {
    return { totalFt: 0, count: 0, details: [], confidence: 'N/A', rerunPerformed: false };
  }

  if (nonZero.length === 1) {
    const details = nonZero[0].details.map((d: { length_ft: number }) => ({ lengthFt: d.length_ft }));
    return { totalFt: nonZero[0].val, count: details.length, details, confidence: 'LOW', rerunPerformed: false };
  }

  // With 2-3 results: check if they all agree within 10%
  if (nonZero.length <= 3) {
    const variance = calcVariance(nonZero.map(v => v.val));
    if (variance <= 0.10) {
      // All agree! Average all of them → HIGH confidence
      const avg = nonZero.reduce((s, v) => s + v.val, 0) / nonZero.length;
      const closest = nonZero.reduce((best, v) => Math.abs(v.val - avg) < Math.abs(best.val - avg) ? v : best);
      const details = closest.details.map((d: { length_ft: number }) => ({ lengthFt: d.length_ft }));
      return { totalFt: Math.round(avg * 10) / 10, count: details.length, details, confidence: 'HIGH', rerunPerformed: false };
    }
    // 2-3 results but >10% variance — if only 2, do best we can
    if (nonZero.length === 2) {
      const avg = (nonZero[0].val + nonZero[1].val) / 2;
      notes.push(`${mk.detail}: 2 passes disagree by ${(variance * 100).toFixed(0)}%`);
      const closest = nonZero.reduce((best, v) => Math.abs(v.val - avg) < Math.abs(best.val - avg) ? v : best);
      const details = closest.details.map((d: { length_ft: number }) => ({ lengthFt: d.length_ft }));
      return { totalFt: Math.round(avg * 10) / 10, count: details.length, details, confidence: 'LOW', rerunPerformed: false };
    }
    // 3 results, >10% — this gets handled below with 4-5 result logic (Round 2 will add more)
  }

  // With 4-5 results: DROP the 2 biggest outliers, keep best 3, average them
  // Sort by distance from median to find outliers
  const sorted = [...nonZero].sort((a, b) => a.val - b.val);
  const median = sorted[Math.floor(sorted.length / 2)].val;
  const byDistance = [...nonZero].sort((a, b) => Math.abs(a.val - median) - Math.abs(b.val - median));

  // Keep the 3 closest to median
  const keepCount = Math.min(3, nonZero.length);
  const kept = byDistance.slice(0, keepCount);
  const dropped = byDistance.slice(keepCount);

  const keptVariance = calcVariance(kept.map(v => v.val));
  const avg = kept.reduce((s, v) => s + v.val, 0) / kept.length;
  const confidence = keptVariance <= 0.10 ? 'HIGH' : keptVariance <= 0.20 ? 'MEDIUM' : 'LOW';

  if (dropped.length > 0) {
    const droppedStr = dropped.map(d => `${d.name}(${d.val.toFixed(0)}ft)`).join(', ');
    const keptStr = kept.map(k => `${k.val.toFixed(0)}ft`).join(', ');
    notes.push(`${mk.detail}: dropped ${droppedStr}, kept [${keptStr}] → ${avg.toFixed(1)}ft (${(keptVariance * 100).toFixed(0)}% var)`);
  }

  if (keptVariance > 0.20) {
    notes.push(`${mk.detail}: ${(keptVariance * 100).toFixed(0)}% variance even after outlier removal — verify on-site`);
  }

  const closest = kept.reduce((best, v) => Math.abs(v.val - avg) < Math.abs(best.val - avg) ? v : best);
  const details = closest.details.map((d: { length_ft: number }) => ({ lengthFt: d.length_ft }));

  return { totalFt: Math.round(avg * 10) / 10, count: details.length, details, confidence, rerunPerformed: false };
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

  // No re-runs — the 3 independent passes are our data.
  // Drop outlier, average the 2 closest. Michael's rule.
  for (const mk of measKeys) {
    const result = await buildMeasurementConsensusSimple(mk, results, notes);
    consensus[mk.detail] = result;
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

  // Pick the best roof outline (prefer the one with most vertices)
  const outlines = results.map(r => r.m.roof_outline).filter((o): o is RoofOutline => !!o && !!o.vertices?.length);
  const roofOutline = outlines.sort((a, b) => b.vertices.length - a.vertices.length)[0] || null;

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
    roofOutline,
    overallConfidence,
    qualityNotes: notes,
    rerunPerformed: false,
  };
}

// ── Geometric Fallback ─────────────────────────────────────────────────────

function buildGeometricFallback(
  width: number, length: number, totalAreaSqFt: number,
  solarSegments: { pitchDegrees?: number; azimuthDegrees?: number; stats?: { areaMeters2?: number } }[]
): AIMeasurements {
  // Use actual Solar API segment data if available
  const avgPitchDeg = solarSegments.length > 0
    ? solarSegments.reduce((s, seg) => s + (seg.pitchDegrees || 20), 0) / solarSegments.length
    : 20; // Default 20° ≈ 4.4/12
  const pitchRatio = Math.max(2, Math.min(16, Math.round(Math.tan(avgPitchDeg * Math.PI / 180) * 12)));
  const slopeFactor = Math.sqrt(1 + (pitchRatio / 12) ** 2);

  // Determine roof style from segment count & azimuth distribution
  const segCount = solarSegments.length || 2;
  const azimuths = solarSegments.map(s => s.azimuthDegrees || 0);
  const uniqueDirs = new Set(azimuths.map(a => Math.round(a / 90) % 4));

  // Hip roof: 4 directions, Gable: 2 directions
  const isHip = uniqueDirs.size >= 4 || segCount >= 4;
  const roofStyle = isHip ? 'hip' : 'gable';

  // Ensure sane dimensions — if Solar API gave us nothing, estimate from area
  const w = width > 10 ? width : Math.sqrt(totalAreaSqFt > 0 ? totalAreaSqFt / slopeFactor : 1600);
  const l = length > 10 ? length : w * 1.3; // Typical house is longer than wide

  // Half-width for slope run
  const halfW = w / 2;
  const slopeRun = halfW * slopeFactor;

  let ridgeFt: number, rakeFt: number, eaveFt: number, valleyFt: number, hipFt: number;
  const ridges: { length_ft: number; confidence: string }[] = [];
  const rakes: { length_ft: number; confidence: string }[] = [];
  const valleys: { length_ft: number; confidence: string }[] = [];
  const eaves: { length_ft: number; confidence: string }[] = [];
  const hips: { length_ft: number; confidence: string }[] = [];

  if (isHip) {
    // Hip roof geometry
    ridgeFt = Math.max(0, l - w); // Ridge = building length minus width
    eaveFt = 2 * (l + w); // Full perimeter
    hipFt = 4 * Math.sqrt(halfW * halfW + slopeRun * slopeRun) * 0.7; // 4 hip lines
    rakeFt = 0; // No rakes on a hip roof
    valleyFt = 0;

    if (ridgeFt > 0) ridges.push({ length_ft: Math.round(ridgeFt), confidence: 'MEDIUM' });
    eaves.push({ length_ft: Math.round(l), confidence: 'MEDIUM' });
    eaves.push({ length_ft: Math.round(l), confidence: 'MEDIUM' });
    eaves.push({ length_ft: Math.round(w), confidence: 'MEDIUM' });
    eaves.push({ length_ft: Math.round(w), confidence: 'MEDIUM' });
    for (let i = 0; i < 4; i++) hips.push({ length_ft: Math.round(hipFt / 4), confidence: 'MEDIUM' });
  } else {
    // Gable roof geometry
    ridgeFt = l; // Full length
    eaveFt = l * 2; // Two eaves (front + back)
    rakeFt = slopeRun * 2 * 2; // 2 gable ends × 2 rakes each... actually 2 rakes per gable = 4 rakes
    hipFt = 0;
    valleyFt = 0;

    ridges.push({ length_ft: Math.round(ridgeFt), confidence: 'MEDIUM' });
    eaves.push({ length_ft: Math.round(l), confidence: 'MEDIUM' });
    eaves.push({ length_ft: Math.round(l), confidence: 'MEDIUM' });
    // 4 rakes (2 per gable end)
    for (let i = 0; i < 4; i++) rakes.push({ length_ft: Math.round(slopeRun), confidence: 'MEDIUM' });
  }

  // Detect valleys from complex roof shapes (>4 segments usually means cross-gables)
  if (segCount > 4) {
    const crossGables = Math.floor((segCount - 4) / 2);
    const valleyLen = slopeRun * 1.4; // Valley runs diagonally
    for (let i = 0; i < crossGables * 2; i++) {
      valleys.push({ length_ft: Math.round(valleyLen), confidence: 'LOW' });
    }
    valleyFt = valleys.reduce((s, v) => s + v.length_ft, 0);
    // Cross-gables also add ridges
    for (let i = 0; i < crossGables; i++) {
      ridges.push({ length_ft: Math.round(w * 0.4), confidence: 'LOW' });
    }
    ridgeFt = ridges.reduce((s, r) => s + r.length_ft, 0);
  }

  // Estimate pipe penetrations from area (roughly 1 per 800 sq ft)
  const estPipes = Math.max(1, Math.round(totalAreaSqFt / 800));

  return {
    ridges, rakes, valleys, eaves, hips,
    pitches: [{ pitch: `${pitchRatio}/12`, confidence: 'MEDIUM' }],
    total_ridge_ft: Math.round(ridgeFt),
    total_rake_ft: Math.round(rakeFt),
    total_valley_ft: Math.round(valleyFt),
    total_eave_ft: Math.round(eaveFt),
    total_hip_ft: Math.round(hipFt),
    primary_pitch: `${pitchRatio}/12`,
    roof_style: roofStyle,
    notes: `Geometric estimation from satellite data (${segCount} segments detected). On-site verification recommended.`,
    components: {
      flashing: [],
      transitions: [],
      vents: [{ type: 'ridge', count: 1, confidence: 'MEDIUM' }],
      pipes: [{ diameter_in: 3, count: estPipes, confidence: 'LOW' }],
      chimneys: [],
      skylights: [],
    },
  };
}

// ── Core analysis (shared by GET and POST) ─────────────────────────────────

async function runSatelliteAnalysis(address: string) {
  const geo = await geocode(address);
  const solar = await getSolarData(geo.lat, geo.lng);
  const solarSegments = solar?.solarPotential?.roofSegmentStats || [];
  const wholeRoof = solar?.solarPotential?.wholeRoofStats;
  let totalAreaSqFt = wholeRoof?.areaMeters2 ? wholeRoof.areaMeters2 * 10.7639 : 0;
  const boundingBox = solar?.solarPotential?.boundingBox || solar?.boundingBox;

  // SANITY CHECK: Google Solar API sometimes includes detached structures (garages, sheds).
  // A typical residential roof is 1500-5000 sqft. Cap at 8000 sqft for residential.
  // If Solar API returns >8000, use only the largest connected segments.
  if (totalAreaSqFt > 8000 && solarSegments.length > 0) {
    // Sort segments by area descending and take only the main structure
    const segAreas = solarSegments
      .map((s: { stats?: { areaMeters2?: number } }) => (s.stats?.areaMeters2 || 0) * 10.7639)
      .sort((a: number, b: number) => b - a);
    
    // Take segments until we reach a reasonable total (cap at 6000 sqft)
    // or stop when adding next segment would exceed 2x the first segment
    let adjusted = 0;
    const mainSegArea = segAreas[0] || 0;
    for (const area of segAreas) {
      if (adjusted > 0 && (adjusted + area > 6000 || area < mainSegArea * 0.05)) break;
      adjusted += area;
    }
    
    if (adjusted < totalAreaSqFt * 0.8) {
      console.warn(`Solar API area ${Math.round(totalAreaSqFt)} sqft seems high. Adjusted to ${Math.round(adjusted)} sqft (likely includes detached structures)`);
      totalAreaSqFt = adjusted;
    }
  }

  // ── MULTI-SOURCE SATELLITE IMAGERY ──
  // Pull from multiple angles, zooms, and offsets for maximum coverage
  const satUrls = [
    // Primary overhead — high zoom, direct center
    `https://maps.googleapis.com/maps/api/staticmap?center=${geo.lat},${geo.lng}&zoom=20&size=640x640&maptype=satellite&key=${GOOGLE_KEY}`,
    // Max zoom — closest detail available
    `https://maps.googleapis.com/maps/api/staticmap?center=${geo.lat},${geo.lng}&zoom=21&size=640x640&maptype=satellite&key=${GOOGLE_KEY}`,
    // Wider context — property boundaries, neighbors for scale reference
    `https://maps.googleapis.com/maps/api/staticmap?center=${geo.lat},${geo.lng}&zoom=19&size=640x640&maptype=satellite&key=${GOOGLE_KEY}`,
    // Offset N — slightly different imagery tile, potentially different capture date
    `https://maps.googleapis.com/maps/api/staticmap?center=${geo.lat + 0.00020},${geo.lng}&zoom=20&size=640x640&maptype=satellite&key=${GOOGLE_KEY}`,
    // Offset E
    `https://maps.googleapis.com/maps/api/staticmap?center=${geo.lat},${geo.lng + 0.00025}&zoom=20&size=640x640&maptype=satellite&key=${GOOGLE_KEY}`,
    // Offset S
    `https://maps.googleapis.com/maps/api/staticmap?center=${geo.lat - 0.00020},${geo.lng}&zoom=20&size=640x640&maptype=satellite&key=${GOOGLE_KEY}`,
    // Offset W
    `https://maps.googleapis.com/maps/api/staticmap?center=${geo.lat},${geo.lng - 0.00025}&zoom=20&size=640x640&maptype=satellite&key=${GOOGLE_KEY}`,
    // Hybrid view — satellite + roads/labels for reference
    `https://maps.googleapis.com/maps/api/staticmap?center=${geo.lat},${geo.lng}&zoom=20&size=640x640&maptype=hybrid&key=${GOOGLE_KEY}`,
  ];

  // Esri/ArcGIS World Imagery — FREE, no API key needed, different satellite source
  const esriUrls: string[] = [];
  // Esri uses x/y/z tile scheme. Convert lat/lng to tile coords at various zooms.
  for (const z of [18, 19, 20]) {
    const n = Math.pow(2, z);
    const tileX = Math.floor((geo.lng + 180) / 360 * n);
    const tileY = Math.floor((1 - Math.log(Math.tan(geo.lat * Math.PI / 180) + 1 / Math.cos(geo.lat * Math.PI / 180)) / Math.PI) / 2 * n);
    esriUrls.push(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${tileY}/${tileX}`);
  }
  // Esri static export (higher res, centered on property)
  const esriExtent = 0.001; // ~100m box
  esriUrls.push(
    `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${geo.lng - esriExtent},${geo.lat - esriExtent},${geo.lng + esriExtent},${geo.lat + esriExtent}&bboxSR=4326&size=640,640&imageSR=4326&format=png&f=image`
  );
  // Tighter crop
  const esriTight = 0.0004;
  esriUrls.push(
    `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${geo.lng - esriTight},${geo.lat - esriTight},${geo.lng + esriTight},${geo.lat + esriTight}&bboxSR=4326&size=640,640&imageSR=4326&format=png&f=image`
  );

  const esriImages = await Promise.all(esriUrls.map(url => fetchImageBase64(url)));
  const validEsriImages = esriImages.filter((img): img is string => img !== null);
  console.log(`Esri imagery: ${validEsriImages.length}/${esriUrls.length} images retrieved`);

  // Bing Maps aerial (different source, different capture date)
  const bingKey = process.env.BING_MAPS_KEY || '';
  const bingUrls: string[] = [];
  if (bingKey) {
    bingUrls.push(
      `https://dev.virtualearth.net/REST/v1/Imagery/Map/Aerial/${geo.lat},${geo.lng}/20?mapSize=640,640&key=${bingKey}`,
      `https://dev.virtualearth.net/REST/v1/Imagery/Map/AerialWithLabels/${geo.lat},${geo.lng}/20?mapSize=640,640&key=${bingKey}`,
    );
  }
  const bingImages = await Promise.all(bingUrls.map(url => fetchImageBase64(url)));
  const validBingImages = bingImages.filter((img): img is string => img !== null);

  // Mapbox satellite (different source)
  const mapboxToken = process.env.MAPBOX_TOKEN || '';
  const mapboxUrls: string[] = [];
  if (mapboxToken) {
    mapboxUrls.push(
      `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${geo.lng},${geo.lat},19,0/640x640?access_token=${mapboxToken}`,
      `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${geo.lng},${geo.lat},20,0/640x640?access_token=${mapboxToken}`,
    );
  }
  const mapboxImages = await Promise.all(mapboxUrls.map(url => fetchImageBase64(url)));
  const validMapboxImages = mapboxImages.filter((img): img is string => img !== null);

  const satImages = await Promise.all(satUrls.map(url => fetchImageBase64(url)));
  const validSatImages = satImages.filter((img): img is string => img !== null);
  const satBase64 = validSatImages[0]; // Primary for display
  console.log(`Satellite imagery: ${validSatImages.length}/${satUrls.length} Google, ${validEsriImages.length} Esri, ${validBingImages.length} Bing, ${validMapboxImages.length} Mapbox`);

  // ── MULTI-ANGLE STREET VIEW ──
  // 8 compass directions + elevated angles for maximum roof visibility
  const svConfigs = [
    // Cardinal directions — standard roof view (30° up)
    { heading: 0, pitch: 30, fov: 90 },     // North
    { heading: 90, pitch: 30, fov: 90 },    // East
    { heading: 180, pitch: 30, fov: 90 },   // South
    { heading: 270, pitch: 30, fov: 90 },   // West
    // Diagonal directions — catches corners and complex geometry
    { heading: 45, pitch: 35, fov: 80 },    // NE
    { heading: 135, pitch: 35, fov: 80 },   // SE
    { heading: 225, pitch: 35, fov: 80 },   // SW
    { heading: 315, pitch: 35, fov: 80 },   // NW
    // High-angle views — steeper look at the roof surface
    { heading: 0, pitch: 55, fov: 70 },     // North steep
    { heading: 180, pitch: 55, fov: 70 },   // South steep
  ];
  const svImages: (string | null)[] = await Promise.all(
    svConfigs.map(({ heading, pitch, fov }) => {
      const url = `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${geo.lat},${geo.lng}&heading=${heading}&pitch=${pitch}&fov=${fov}&key=${GOOGLE_KEY}`;
      return fetchImageBase64(url);
    })
  );
  const validSvImages = svImages.filter((img): img is string => img !== null);
  console.log(`Street view: ${validSvImages.length}/${svConfigs.length} images retrieved`);
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

  // Core images for each phase
  const googleSatCore = validSatImages.slice(0, 3); // zoom 20, 21, 19
  const esriCore = validEsriImages.slice(0, 2);
  const svCore = validSvImages.slice(0, 4); // N, E, S, W

  if ([...validSatImages, ...validEsriImages].length === 0) {
    throw new Error('Could not retrieve any imagery for this address');
  }

  const qualityNotes: string[] = [];
  const allAiResults: { name: string; m: AIMeasurements }[] = [];

  // ── THREE INDEPENDENT PASSES — accuracy over speed ──
  // Each pass uses DIFFERENT image sets so they're truly independent.
  // Then: compare all 3, drop the outlier, average the 2 that agree.
  // Michael's rule: "3 samples, drop the outlier, keep the two closest."

  const measKeys: MeasKey[] = ['total_ridge_ft', 'total_rake_ft', 'total_valley_ft', 'total_eave_ft', 'total_hip_ft'];
  function checkConvergence(results: { name: string; m: AIMeasurements }[], threshold: number): { converged: boolean; worstVariance: number; worstKey: string } {
    let worstVariance = 0;
    let worstKey = '';
    for (const mk of measKeys) {
      const vals = results.map(r => r.m[mk] || 0).filter(v => v > 0);
      if (vals.length >= 2) {
        const v = calcVariance(vals);
        if (v > worstVariance) { worstVariance = v; worstKey = mk; }
      }
    }
    return { converged: worstVariance <= threshold, worstVariance, worstKey };
  }

  // ══════════════════════════════════════════════════════════════════════
  // MICHAEL'S RULE: 3 samples first. If within 10% → average all 3, done.
  // If NOT within 10% → get 2 MORE (5 total), drop 2 outliers, average best 3.
  // If those 3 within 10% → good accuracy. If not → report anyway, lower confidence.
  // ══════════════════════════════════════════════════════════════════════

  // ── ROUND 1: Three independent passes with different images + models ──

  // Pass 1: Gemini with Google satellite only
  console.log('Pass 1/3: Gemini + Google satellite...');
  const pass1 = await callGemini(prompt, [...googleSatCore]);
  if (pass1.measurements) allAiResults.push({ name: 'Pass1-Gemini-GoogleSat', m: pass1.measurements });
  if (pass1.status !== 'success') qualityNotes.push(`Pass 1: ${pass1.status}`);

  // Pass 2: GeminiVerify (lower temp) with Esri + some Google
  console.log('Pass 2/3: GeminiVerify + Esri imagery...');
  const pass2 = await callGeminiVerify(prompt, [...esriCore, ...googleSatCore.slice(0, 2)]);
  if (pass2.measurements) allAiResults.push({ name: 'Pass2-GeminiVerify-Esri', m: pass2.measurements });
  if (pass2.status !== 'success') qualityNotes.push(`Pass 2: ${pass2.status}`);

  // Pass 3: Ollama local model (truly independent AI engine)
  console.log('Pass 3/3: Ollama local model...');
  const pass3 = await callOllama(prompt, [...googleSatCore.slice(0, 2), ...esriCore.slice(0, 1)].filter(Boolean));
  if (pass3.measurements) allAiResults.push({ name: 'Pass3-Ollama-Local', m: pass3.measurements });
  if (pass3.status !== 'success') qualityNotes.push(`Pass 3 Ollama: ${pass3.status}`);

  // If Ollama failed, do a 3rd Gemini pass with street view as fallback
  if (!pass3.measurements && validSvImages.length > 0) {
    console.log('Pass 3 fallback: Gemini + Street View...');
    const pass3b = await callGemini(prompt, [...svCore, ...googleSatCore.slice(0, 1)]);
    if (pass3b.measurements) allAiResults.push({ name: 'Pass3-Gemini-StreetView', m: pass3b.measurements });
    if (pass3b.status !== 'success') qualityNotes.push(`Pass 3 fallback: ${pass3b.status}`);
  }

  let convergence = checkConvergence(allAiResults, 0.10);
  console.log(`Round 1: ${allAiResults.length}/3 passes succeeded, worst variance ${(convergence.worstVariance * 100).toFixed(1)}% (${convergence.worstKey})`);

  // ── ROUND 2: If not within 10%, get 2 more passes (5 total) ──
  if (!convergence.converged && allAiResults.length >= 2) {
    qualityNotes.push(`Round 1 variance ${(convergence.worstVariance * 100).toFixed(0)}% on ${convergence.worstKey} — getting 2 more passes...`);
    console.log('Round 2: Adding 2 more passes for 5-sample consensus...');

    // Pass 4: Gemini with ALL satellite + Esri (wider image set)
    const pass4 = await callGemini(prompt, [...validSatImages.slice(0, 4), ...validEsriImages.slice(0, 2)]);
    if (pass4.measurements) allAiResults.push({ name: 'Pass4-Gemini-AllSat', m: pass4.measurements });

    // Pass 5: GeminiVerify with street view + satellite (different angle perspective)
    const pass5 = await callGeminiVerify(prompt, [...svCore, ...googleSatCore.slice(0, 2), ...esriCore.slice(0, 1)]);
    if (pass5.measurements) allAiResults.push({ name: 'Pass5-GeminiVerify-SV', m: pass5.measurements });

    convergence = checkConvergence(allAiResults, 0.10);
    console.log(`Round 2: ${allAiResults.length} total passes, worst variance ${(convergence.worstVariance * 100).toFixed(1)}%`);
    qualityNotes.push(`Round 2 complete: ${allAiResults.length} passes, ${(convergence.worstVariance * 100).toFixed(1)}% final variance`);
  } else if (convergence.converged) {
    qualityNotes.push(`All 3 passes converged within 10% — high confidence`);
  }

  // If we still have < 2 results, try harder
  if (allAiResults.length < 2) {
    qualityNotes.push(`Only ${allAiResults.length} pass succeeded — running emergency attempts...`);
    const [emergA, emergB] = await Promise.allSettled([
      callGemini(prompt, [...validSatImages.slice(0, 4), ...svCore]),
      callGeminiVerify(prompt, [...validSatImages.slice(0, 4), ...svCore]),
    ]).then(r => r.map(x => x.status === 'fulfilled' ? x.value : { status: 'error', measurements: null, raw: 'rejected' } as AIResult));
    if (emergA.measurements) allAiResults.push({ name: 'Emergency-Gemini', m: emergA.measurements });
    if (emergB.measurements) allAiResults.push({ name: 'Emergency-GeminiVerify', m: emergB.measurements });
    convergence = checkConvergence(allAiResults, 0.10);
  }

  // ── FALLBACK: If zero AI results, use geometric estimation ──
  if (allAiResults.length === 0) {
    qualityNotes.push('All AI providers failed — using geometric estimation from satellite data');
    const fallbackMeasurements = buildGeometricFallback(buildingWidth, buildingLength, totalAreaSqFt, solarSegments);
    allAiResults.push({ name: 'GeometricFallback', m: fallbackMeasurements });
  }

  qualityNotes.push(`Pipeline: ${allAiResults.length} passes, final variance ${(convergence.worstVariance * 100).toFixed(1)}%`);
  if (validSvImages.length < 3) qualityNotes.push(`Only ${validSvImages.length}/10 street view angles available`);
  if (!solar) qualityNotes.push('Solar API data unavailable - measurements may be less accurate');

  // Cross-validate against Solar API geometric data
  if (solar && totalAreaSqFt > 0) {
    qualityNotes.push(`Solar cross-validation: roof area ${Math.round(totalAreaSqFt)} sq ft, ${solarSegments.length} segments`);
  }

  const allImages = [...validSatImages, ...validEsriImages, ...validSvImages];
  const consensusResult = await buildConsensus(allAiResults, allImages, prompt);
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
    validEsriImages,
    validBingImages,
    validMapboxImages,
    buildingWidth,
    buildingLength,
    totalAreaSqFt,
    solarSegments,
    segments,
    measurements: consensusResult.measurements,
    components: consensusResult.components,
    roofOutline: consensusResult.roofOutline,
    overallConfidence: consensusResult.overallConfidence,
    rerunPerformed: consensusResult.rerunPerformed,
    qualityNotes,
    pipelinePhase: allAiResults.length, // now = number of independent passes
    totalAiPasses: allAiResults.length,
    finalVariance: convergence.worstVariance,
    aiResults: {
      pass1: { name: allAiResults[0]?.name || 'none', status: allAiResults[0] ? 'success' : 'failed' },
      pass2: { name: allAiResults[1]?.name || 'none', status: allAiResults[1] ? 'success' : 'failed' },
      pass3: { name: allAiResults[2]?.name || 'none', status: allAiResults[2] ? 'success' : 'failed' },
    },
    allProviderResults: allAiResults.map(r => ({ name: r.name, totalRidge: r.m.total_ridge_ft, totalRake: r.m.total_rake_ft, totalEave: r.m.total_eave_ft })),
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

  // Primary: Gemini only. Ollama fallback if both fail.
  const [geminiResult, geminiVerifyResult] = await Promise.all([
    callGemini(enhancedPrompt, allImages),
    callGeminiVerify(enhancedPrompt, allImages),
  ]);

  let ollamaResult: AIResult = { status: 'skipped', measurements: null, raw: 'Skipped — Gemini succeeded' };
  if (!geminiResult.measurements && !geminiVerifyResult.measurements) {
    ollamaResult = await callOllama(enhancedPrompt, allImages);
  }

  const successfulResults: { name: string; m: AIMeasurements }[] = [];
  if (geminiResult.measurements) successfulResults.push({ name: 'Gemini', m: geminiResult.measurements });
  if (geminiVerifyResult.measurements) successfulResults.push({ name: 'GeminiVerify', m: geminiVerifyResult.measurements });
  if (ollamaResult.measurements) successfulResults.push({ name: 'Ollama', m: ollamaResult.measurements });

  const qualityNotes: string[] = [];
  if (geminiResult.status !== 'success') qualityNotes.push(`Photo-Gemini: ${geminiResult.status}`);
  if (geminiVerifyResult.status !== 'success') qualityNotes.push(`Photo-GeminiVerify: ${geminiVerifyResult.status}`);

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
    roofOutline: sat.roofOutline,
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
      esriAerial: (sat.validEsriImages || []).map((img: string) => `data:image/png;base64,${img}`),
      bingAerial: (sat.validBingImages || []).map((img: string) => `data:image/png;base64,${img}`),
      mapboxSatellite: (sat.validMapboxImages || []).map((img: string) => `data:image/png;base64,${img}`),
    },
    mode: enhanced ? 'enhanced' : 'satellite',
    photoCount,
    pipeline: {
      phase: sat.pipelinePhase || 1,
      totalAiPasses: sat.totalAiPasses || 0,
      finalVariance: sat.finalVariance || 0,
      allProviderResults: sat.allProviderResults || [],
    },
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
