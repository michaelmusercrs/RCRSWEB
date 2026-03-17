/**
 * Roof Measurement Service
 *
 * Ported from the standalone roof-measure-tool into the RCRS codebase.
 * Pipeline: Geocode -> Solar API -> Collect Images -> AI Measurement (parallel) -> Consensus -> Response
 *
 * Uses multi-AI consensus ("Michael's Rule"):
 * - All engines within 10%? -> average -> HIGH confidence
 * - Otherwise, find best 3 of 5 -> MEDIUM or LOW
 *
 * AI Engines: Vertex AI Gemini, Gemini AI Studio, Claude (Anthropic), Ollama (local)
 * Measures: ridge, rake, valley, eave, hip (linear feet), pitch, roof style, components
 */

import { roofReportService } from './roof-report-service';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY ?? GOOGLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_SA_KEY = process.env.GOOGLE_PRIVATE_KEY;
const VERTEX_PROJECT = process.env.VERTEX_PROJECT ?? 'gen-lang-client-0821717467';
const VERTEX_LOCATION = process.env.VERTEX_LOCATION ?? 'us-central1';
const IS_VERCEL = !!process.env.VERCEL;
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// Decatur, AL bias bounds for geocoding
const GEOCODE_BOUNDS = '34.35,-87.20|34.75,-86.70';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeoResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export interface SolarData {
  totalArea: number;
  segments: number;
  pitchDegrees: number[];
  boundingBox: { north: number; south: number; east: number; west: number };
  rawSegments: any[];
}

export interface CollectedImage {
  source: string;
  label: string;
  base64: string; // data URI
  width: number;
  height: number;
}

export interface LineDetail {
  lengthFt: number;
  description?: string;
}

export interface MeasurementCategory {
  totalFt: number;
  count: number;
  details: LineDetail[];
  confidence: string;
}

export interface EngineResult {
  engine: string;
  ridges: LineDetail[];
  rakes: LineDetail[];
  valleys: LineDetail[];
  eaves: LineDetail[];
  hips: LineDetail[];
  pitches: string[];
  totalRoofAreaSqFt: number;
  roofStyle: string;
  components: {
    vents: number;
    pipes: number;
    chimneys: number;
    skylights: number;
    flashing: number;
  };
  raw?: any;
  error?: string;
}

export interface MeasurementResult {
  address: string;
  lat: number;
  lng: number;
  solarData: SolarData | null;
  measurements: {
    ridge: MeasurementCategory;
    rake: MeasurementCategory;
    valley: MeasurementCategory;
    eave: MeasurementCategory;
    hip: MeasurementCategory;
  };
  pitch: string;
  roofStyle: string;
  components: EngineResult['components'];
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  qualityNotes: string[];
  images: CollectedImage[];
  providerResults: EngineResult[];
  needsMoreImages: boolean;
}

export interface MeasureOptions {
  latLng?: { lat: number; lng: number };
  images?: string[];
  selectedStreetViewHeadings?: number[];
  structures?: { name: string; points: { lat: number; lng: number }[] }[];
  uploadedPhotos?: string[];
}

interface ConsensusResult {
  value: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  usedEngines: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch an image URL and return base64 data URI. Rejects tiny images (<5KB = error pages). */
async function fetchImageBase64(url: string, mimeOverride?: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}): ${url}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 5000) {
    throw new Error(`Image too small (${buf.byteLength} bytes) — likely an error page: ${url}`);
  }
  const mime = mimeOverride ?? res.headers.get('content-type') ?? 'image/jpeg';
  const b64 = Buffer.from(buf).toString('base64');
  return `data:${mime};base64,${b64}`;
}

/** Strip markdown fences, fix Python-isms, parse JSON robustly. */
function parseAIJson(raw: string): any {
  let cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
  cleaned = cleaned
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null');

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* fall through */
      }
    }
    throw new Error('Failed to parse AI JSON response');
  }
}

/** Sum an array of LineDetail lengths. */
function sumLines(lines: LineDetail[]): number {
  return lines.reduce((s, l) => s + (l.lengthFt ?? 0), 0);
}

/** Extract base64 content from data URI. */
function dataUriToBase64(dataUri: string): string {
  return dataUri.replace(/^data:[^;]+;base64,/, '');
}

/** Extract MIME from data URI. */
function dataUriMime(dataUri: string): string {
  const match = dataUri.match(/^data:([^;]+);base64,/);
  return match?.[1] ?? 'image/jpeg';
}

/** Statistical mode (most frequent value). */
function mode(arr: string[]): string | undefined {
  const freq: Record<string, number> = {};
  for (const v of arr) freq[v] = (freq[v] ?? 0) + 1;
  let best: string | undefined;
  let bestCount = 0;
  for (const [k, c] of Object.entries(freq)) {
    if (c > bestCount) {
      best = k;
      bestCount = c;
    }
  }
  return best;
}

/** Average of numbers. */
function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

/** Create an empty/error result for a failed engine. */
function emptyResult(engine: string, error: string): EngineResult {
  return {
    engine,
    ridges: [],
    rakes: [],
    valleys: [],
    eaves: [],
    hips: [],
    pitches: [],
    totalRoofAreaSqFt: 0,
    roofStyle: 'unknown',
    components: { vents: 0, pipes: 0, chimneys: 0, skylights: 0, flashing: 0 },
    error,
  };
}

// ---------------------------------------------------------------------------
// AI Measurement Prompt
// ---------------------------------------------------------------------------

function buildMeasurementPrompt(
  solarData: SolarData | null,
  imageCount: { streetView: number; overhead: number }
): string {
  const solarContext = solarData
    ? `\nREFERENCE DATA from Google Solar API:\n` +
      `- Total roof area: ~${solarData.totalArea} sq ft\n` +
      `- Number of roof segments: ${solarData.segments}\n` +
      `- Pitch angles (degrees): ${solarData.pitchDegrees.map((d) => d.toFixed(1)).join(', ')}\n` +
      `Use these as a SCALE REFERENCE when estimating line measurements.\n`
    : '\nNo Solar API data available — estimate dimensions from image scale alone.\n';

  return `You are a professional roof measurement AI. You will analyze ${imageCount.streetView + imageCount.overhead} images of a residential property.

The FIRST ${imageCount.streetView} images are STREET VIEW (ground-level photos).
The LAST ${imageCount.overhead} images are OVERHEAD (satellite/aerial).

STEP 1: Look at the STREET VIEW images (the ground-level photos). Determine the roof pitch by looking at the slope angle from the side. Most residential roofs are between 4/12 and 10/12. If you see any slope at all, it is NOT a flat roof.

STEP 2: Look at the OVERHEAD images. Determine the roof layout, dimensions, and line measurements. Identify all ridge lines, rake edges, valley lines, eave edges, and hip lines.

STEP 3: Combine both to produce measurements.
${solarContext}
Return ONLY a JSON object (no markdown, no explanation) with this exact structure:
{
  "ridges": [{"lengthFt": <number>, "description": "<optional>"}],
  "rakes": [{"lengthFt": <number>, "description": "<optional>"}],
  "valleys": [{"lengthFt": <number>, "description": "<optional>"}],
  "eaves": [{"lengthFt": <number>, "description": "<optional>"}],
  "hips": [{"lengthFt": <number>, "description": "<optional>"}],
  "pitches": ["<e.g. 6/12>"],
  "totalRoofAreaSqFt": <number>,
  "roofStyle": "<gable|hip|cross-gable|dutch-hip|gambrel|mansard|flat|shed|combination>",
  "components": {
    "vents": <number>,
    "pipes": <number>,
    "chimneys": <number>,
    "skylights": <number>,
    "flashing": <number>
  }
}

Be precise. Measure in feet. Count every line segment.`;
}

// ---------------------------------------------------------------------------
// AI Engine: Gemini (AI Studio)
// ---------------------------------------------------------------------------

async function runGemini(
  model: string,
  prompt: string,
  images: CollectedImage[],
  temperature: number = 0.4
): Promise<EngineResult> {
  const engineLabel = `Gemini ${model} (t=${temperature})`;
  if (!GEMINI_KEY) return emptyResult(engineLabel, 'No Gemini API key configured');

  const MAX_RETRIES = 2;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const parts: any[] = [{ text: prompt }];
      for (const img of images) {
        parts.push({
          inline_data: {
            mime_type: dataUriMime(img.base64),
            data: dataUriToBase64(img.base64),
          },
        });
      }

      const apiVersions = ['v1beta', 'v1'];
      let lastErr = '';
      for (const apiVer of apiVersions) {
        const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${model}:generateContent?key=${GEMINI_KEY}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature, maxOutputTokens: 4096 },
          }),
        });

        if (res.status === 429) {
          const errText = await res.text();
          if (errText.includes('limit: 0') || errText.includes('RESOURCE_EXHAUSTED')) {
            lastErr = `Gemini free tier quota exhausted for ${model}.`;
            break;
          }
          if (attempt < MAX_RETRIES) {
            const wait = attempt * 15000;
            // Rate limited (429), retrying
            await new Promise((r) => setTimeout(r, wait));
            break;
          }
          lastErr = `Gemini API 429 (rate limited): ${errText.slice(0, 200)}`;
          continue;
        }

        if (!res.ok) {
          const errText = await res.text();
          lastErr = `Gemini API ${res.status}: ${errText.slice(0, 200)}`;
          continue;
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const parsed = parseAIJson(text);

        return {
          engine: engineLabel,
          ridges: parsed.ridges ?? [],
          rakes: parsed.rakes ?? [],
          valleys: parsed.valleys ?? [],
          eaves: parsed.eaves ?? [],
          hips: parsed.hips ?? [],
          pitches: parsed.pitches ?? [],
          totalRoofAreaSqFt: parsed.totalRoofAreaSqFt ?? 0,
          roofStyle: parsed.roofStyle ?? 'unknown',
          components: parsed.components ?? { vents: 0, pipes: 0, chimneys: 0, skylights: 0, flashing: 0 },
          raw: parsed,
        };
      }

      if (lastErr.includes('quota exhausted')) {
        return emptyResult(engineLabel, lastErr);
      }
      if (attempt >= MAX_RETRIES) {
        return emptyResult(engineLabel, lastErr || 'All API versions failed');
      }
    } catch (err: any) {
      console.error(`${engineLabel} error:`, err.message);
      return emptyResult(engineLabel, err.message);
    }
  }
  return emptyResult(engineLabel, 'Max retries exceeded');
}

// ---------------------------------------------------------------------------
// AI Engine: Claude (Anthropic)
// ---------------------------------------------------------------------------

async function runClaude(prompt: string, images: CollectedImage[]): Promise<EngineResult> {
  const engineLabel = 'Claude (Anthropic)';
  try {
    if (!ANTHROPIC_KEY) throw new Error('No Anthropic API key configured');

    const content: any[] = [];
    for (const img of images) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: dataUriMime(img.base64),
          data: dataUriToBase64(img.base64),
        },
      });
    }
    content.push({ type: 'text', text: prompt });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data.content?.find((c: any) => c.type === 'text')?.text ?? '';
    const parsed = parseAIJson(text);

    return {
      engine: engineLabel,
      ridges: parsed.ridges ?? [],
      rakes: parsed.rakes ?? [],
      valleys: parsed.valleys ?? [],
      eaves: parsed.eaves ?? [],
      hips: parsed.hips ?? [],
      pitches: parsed.pitches ?? [],
      totalRoofAreaSqFt: parsed.totalRoofAreaSqFt ?? 0,
      roofStyle: parsed.roofStyle ?? 'unknown',
      components: parsed.components ?? { vents: 0, pipes: 0, chimneys: 0, skylights: 0, flashing: 0 },
      raw: parsed,
    };
  } catch (err: any) {
    console.error(`${engineLabel} error:`, err.message);
    return emptyResult(engineLabel, err.message);
  }
}

// ---------------------------------------------------------------------------
// AI Engine: Vertex AI (Google Cloud)
// ---------------------------------------------------------------------------

async function getVertexAccessToken(): Promise<string> {
  if (!GOOGLE_SA_EMAIL || !GOOGLE_SA_KEY) {
    throw new Error('No Google service account credentials');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: GOOGLE_SA_EMAIL,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  ).toString('base64url');

  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const pemKey = GOOGLE_SA_KEY.split('\\n').join('\n');
  const signature = sign.sign(pemKey, 'base64url');

  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Token exchange returned no access_token: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.access_token;
}

async function runVertexAI(
  model: string,
  prompt: string,
  images: CollectedImage[],
  temperature: number = 0.4
): Promise<EngineResult> {
  const engineLabel = `Vertex AI ${model} (t=${temperature})`;
  try {
    if (!GOOGLE_SA_EMAIL || !GOOGLE_SA_KEY) {
      throw new Error('No Google service account credentials configured');
    }

    const accessToken = await getVertexAccessToken();

    const parts: any[] = [{ text: prompt }];
    for (const img of images) {
      parts.push({
        inlineData: {
          mimeType: dataUriMime(img.base64),
          data: dataUriToBase64(img.base64),
        },
      });
    }

    const url =
      `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}` +
      `/locations/${VERTEX_LOCATION}/publishers/google/models/${model}:generateContent`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature, maxOutputTokens: 4096 },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 403) {
        throw new Error(`Vertex AI 403 Forbidden: Enable the Vertex AI API and grant 'Vertex AI User' role. ${errText.slice(0, 200)}`);
      }
      throw new Error(`Vertex AI ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = parseAIJson(text);

    return {
      engine: engineLabel,
      ridges: parsed.ridges ?? [],
      rakes: parsed.rakes ?? [],
      valleys: parsed.valleys ?? [],
      eaves: parsed.eaves ?? [],
      hips: parsed.hips ?? [],
      pitches: parsed.pitches ?? [],
      totalRoofAreaSqFt: parsed.totalRoofAreaSqFt ?? 0,
      roofStyle: parsed.roofStyle ?? 'unknown',
      components: parsed.components ?? { vents: 0, pipes: 0, chimneys: 0, skylights: 0, flashing: 0 },
      raw: parsed,
    };
  } catch (err: any) {
    console.error(`${engineLabel} error:`, err.message);
    return emptyResult(engineLabel, err.message);
  }
}

// ---------------------------------------------------------------------------
// AI Engine: Ollama (local vision models)
// ---------------------------------------------------------------------------

const OLLAMA_MODELS = ['roof-llava:latest', 'llava:7b', 'river:latest'];

async function runOllama(
  prompt: string,
  images: CollectedImage[],
  modelOverride?: string
): Promise<EngineResult> {
  const modelName = modelOverride ?? OLLAMA_MODELS[0];
  const engineLabel = `Ollama ${modelName} (local)`;
  if (IS_VERCEL) {
    return emptyResult(engineLabel, 'Skipped on Vercel');
  }

  try {
    // Check if Ollama is reachable
    try {
      const ping = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!ping.ok) throw new Error('Ollama not reachable');
    } catch {
      return emptyResult(engineLabel, 'Ollama not running at ' + OLLAMA_URL);
    }

    const imageB64s = images.map((img) => dataUriToBase64(img.base64));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt,
        images: imageB64s,
        stream: false,
        options: { temperature: 0.4, num_predict: 4096 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const parsed = parseAIJson(data.response ?? '');

    return {
      engine: engineLabel,
      ridges: parsed.ridges ?? [],
      rakes: parsed.rakes ?? [],
      valleys: parsed.valleys ?? [],
      eaves: parsed.eaves ?? [],
      hips: parsed.hips ?? [],
      pitches: parsed.pitches ?? [],
      totalRoofAreaSqFt: parsed.totalRoofAreaSqFt ?? 0,
      roofStyle: parsed.roofStyle ?? 'unknown',
      components: parsed.components ?? { vents: 0, pipes: 0, chimneys: 0, skylights: 0, flashing: 0 },
      raw: parsed,
    };
  } catch (err: any) {
    console.error(`${engineLabel} error:`, err.message);
    return emptyResult(engineLabel, err.message);
  }
}

// ---------------------------------------------------------------------------
// Consensus: Michael's Rule
// ---------------------------------------------------------------------------

/**
 * Given an array of numeric values from engines, apply Michael's Rule:
 * - All within 10%? -> average -> HIGH
 * - Otherwise, find best 3 of 5 -> MEDIUM or LOW
 */
function applyConsensus(values: { engine: string; value: number }[]): ConsensusResult {
  const valid = values.filter((v) => v.value > 0);

  if (valid.length === 0) {
    return { value: 0, confidence: 'LOW', usedEngines: [] };
  }
  if (valid.length === 1) {
    return { value: valid[0].value, confidence: 'LOW', usedEngines: [valid[0].engine] };
  }

  const sorted = [...valid].sort((a, b) => a.value - b.value);
  const min = sorted[0].value;
  const max = sorted[sorted.length - 1].value;
  const variance = (max - min) / min;

  if (variance <= 0.1) {
    // All within 10% — HIGH confidence
    const avgVal = valid.reduce((s, v) => s + v.value, 0) / valid.length;
    return {
      value: Math.round(avgVal * 10) / 10,
      confidence: 'HIGH',
      usedEngines: valid.map((v) => v.engine),
    };
  }

  // Need to find best 3
  if (valid.length >= 3) {
    return findBest3(sorted);
  }

  // Only 2 valid, disagree >10%
  const avgVal = valid.reduce((s, v) => s + v.value, 0) / valid.length;
  return { value: Math.round(avgVal * 10) / 10, confidence: 'LOW', usedEngines: valid.map((v) => v.engine) };
}

/** Find the 3 closest values from a sorted array. */
function findBest3(sorted: { engine: string; value: number }[]): ConsensusResult {
  let bestSpread = Infinity;
  let bestTriple: typeof sorted = [];

  for (let i = 0; i <= sorted.length - 3; i++) {
    const triple = sorted.slice(i, i + 3);
    const spread = (triple[2].value - triple[0].value) / triple[0].value;
    if (spread < bestSpread) {
      bestSpread = spread;
      bestTriple = triple;
    }
  }

  const avgVal = bestTriple.reduce((s, v) => s + v.value, 0) / bestTriple.length;
  const confidence = bestSpread <= 0.1 ? 'MEDIUM' : 'LOW';

  return {
    value: Math.round(avgVal * 10) / 10,
    confidence,
    usedEngines: bestTriple.map((v) => v.engine),
  };
}

// ---------------------------------------------------------------------------
// RoofMeasureService Class
// ---------------------------------------------------------------------------

class RoofMeasureService {
  /**
   * Full roof measurement pipeline for an address.
   */
  async measureRoof(address: string, options?: MeasureOptions): Promise<MeasurementResult> {
    const qualityNotes: string[] = [];

    // STEP 1: Geocode
    let geo: GeoResult;
    if (options?.latLng) {
      geo = { lat: options.latLng.lat, lng: options.latLng.lng, formattedAddress: address };
      qualityNotes.push(`Using provided coordinates: ${geo.lat}, ${geo.lng}`);
    } else {
      geo = await this.geocodeAddress(address);
      qualityNotes.push(`Geocoded to: ${geo.formattedAddress}`);
    }

    // STEP 2: Solar API
    const solarData = await this.getSolarData(geo.lat, geo.lng);
    if (solarData) {
      qualityNotes.push(`Solar API: ${solarData.totalArea} sqft, ${solarData.segments} segments`);
    } else {
      qualityNotes.push('Solar API: no data available -- estimating from images only');
    }

    // STEP 3: Collect images
    let images: CollectedImage[];
    if (options?.images && options.images.length > 0) {
      // User selected specific overhead images
      const fetched = await Promise.allSettled(
        options.images.map(async (url, i) => {
          const b64 = await fetchImageBase64(url);
          return { source: `user_selected_${i}`, label: `Selected Image ${i + 1}`, base64: b64, width: 640, height: 640 } as CollectedImage;
        })
      );
      images = fetched
        .filter((r): r is PromiseFulfilledResult<CollectedImage> => r.status === 'fulfilled')
        .map((r) => r.value);
      qualityNotes.push(`Fetched ${images.length}/${options.images.length} user-selected overhead images`);

      // Fetch street view images
      const svHeadings = options?.selectedStreetViewHeadings ?? [0, 120, 240];
      const svFetches = await Promise.allSettled(
        svHeadings.map(async (heading) => {
          const url =
            `https://maps.googleapis.com/maps/api/streetview?size=640x640` +
            `&location=${geo.lat},${geo.lng}&heading=${heading}&pitch=30&fov=90&key=${GOOGLE_KEY}`;
          const b64 = await fetchImageBase64(url);
          return { source: `street_view_${heading}`, label: `Street View (heading ${heading})`, base64: b64, width: 640, height: 640 } as CollectedImage;
        })
      );
      const svImages = svFetches
        .filter((r): r is PromiseFulfilledResult<CollectedImage> => r.status === 'fulfilled')
        .map((r) => r.value);
      images.push(...svImages);
      qualityNotes.push(`Fetched ${svImages.length}/${svHeadings.length} street view images`);
    } else {
      images = await this.collectImages(geo.lat, geo.lng, solarData);
      qualityNotes.push(`Collected ${images.length} images`);
    }

    // Add uploaded photos
    if (options?.uploadedPhotos?.length) {
      for (let i = 0; i < options.uploadedPhotos.length; i++) {
        images.push({
          source: `uploaded_${i}`,
          label: `User Photo ${i + 1}`,
          base64: options.uploadedPhotos[i],
          width: 0,
          height: 0,
        });
      }
      qualityNotes.push(`Added ${options.uploadedPhotos.length} user-uploaded photos`);
    }

    if (options?.structures && options.structures.length > 0) {
      qualityNotes.push(`User outlined ${options.structures.length} structure(s): ${options.structures.map((s) => s.name).join(', ')}`);
    }

    // Separate street views and overhead
    const streetViews = images.filter(
      (img) => img.source.startsWith('street_view') || img.source.startsWith('uploaded')
    );
    const overhead = images.filter(
      (img) => !img.source.startsWith('street_view') && !img.source.startsWith('uploaded')
    );
    const orderedImages = [...streetViews, ...overhead];

    // STEP 4: Run AI engines
    const engineResults = await this.runAIEngines(orderedImages, solarData, streetViews.length, overhead.length);
    const allEngines = [...engineResults];

    // If <2 succeeded, run fallback engines
    const hasVertex = !!(GOOGLE_SA_EMAIL && GOOGLE_SA_KEY);
    const hasClaude = !!ANTHROPIC_KEY;
    const prompt = buildMeasurementPrompt(solarData, { streetView: streetViews.length, overhead: overhead.length });

    const successCount = allEngines.filter((r) => !r.error).length;
    if (successCount < 2) {
      qualityNotes.push(`Only ${successCount} engine(s) succeeded initially -- running fallbacks...`);

      if (hasVertex && allEngines[0]?.error) {
        const fb = await runGemini('gemini-2.0-flash', prompt, orderedImages, 0.4);
        allEngines.push(fb);
      } else if (!hasVertex && allEngines[0]?.error) {
        await new Promise((r) => setTimeout(r, 3000));
        const fb = await runGemini('gemini-2.5-flash', prompt, orderedImages, 0.3);
        allEngines.push(fb);
      }

      if (allEngines.filter((r) => !r.error).length < 2 && hasClaude && !allEngines.some(e => e.engine.includes('Claude') && !e.error)) {
        const fb = await runClaude(prompt, orderedImages);
        allEngines.push(fb);
      }
    }

    qualityNotes.push(
      `AI engines completed: ${allEngines.map((r) => `${r.engine}${r.error ? ' (FAILED)' : ' (OK)'}`).join(', ')}`
    );
    for (const r of allEngines) {
      if (r.error) {
        qualityNotes.push(`[${r.engine}] Error: ${r.error.slice(0, 150)}`);
      }
    }

    const initialResults = allEngines.filter((r) => !r.error);

    if (initialResults.length === 0) {
      qualityNotes.push('ALL AI engines failed — no measurements available');
      return this.buildEmptyResponse(geo, solarData, images, qualityNotes, allEngines);
    }

    // STEP 5: Consensus (Michael's Rule)
    const result = await this.buildConsensus(initialResults, allEngines, orderedImages, solarData, prompt, qualityNotes, hasVertex);

    const needsMoreImages = result.overallConfidence === 'LOW';
    if (needsMoreImages) {
      qualityNotes.push('LOW confidence -- on-site photos recommended for better accuracy');
    }

    return {
      address: geo.formattedAddress,
      lat: geo.lat,
      lng: geo.lng,
      solarData,
      measurements: result.measurements,
      pitch: result.pitch,
      roofStyle: result.roofStyle,
      components: result.components,
      overallConfidence: result.overallConfidence,
      qualityNotes,
      images,
      providerResults: result.allProviderResults,
      needsMoreImages,
    };
  }

  /**
   * Geocode an address to lat/lng.
   */
  async geocodeAddress(address: string): Promise<GeoResult> {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('bounds', GEOCODE_BOUNDS);
    url.searchParams.set('key', GOOGLE_KEY);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.length) {
      throw new Error(`Geocoding failed: ${data.status} — ${data.error_message ?? 'no results'}`);
    }

    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
    };
  }

  /**
   * Get Google Solar API building insights.
   */
  async getSolarData(lat: number, lng: number): Promise<SolarData | null> {
    try {
      const url = new URL('https://solar.googleapis.com/v1/buildingInsights:findClosest');
      url.searchParams.set('location.latitude', lat.toString());
      url.searchParams.set('location.longitude', lng.toString());
      url.searchParams.set('requiredQuality', 'HIGH');
      url.searchParams.set('key', GOOGLE_KEY);

      const res = await fetch(url.toString());
      if (!res.ok) {
        console.warn(`Solar API returned ${res.status}`);
        return null;
      }
      const data = await res.json();

      const segments = data.solarPotential?.roofSegmentStats ?? [];
      const totalArea = segments.reduce((sum: number, s: any) => sum + (s.stats?.areaMeters2 ?? 0), 0);
      const pitchDegrees = segments.map((s: any) => s.pitchDegrees ?? 0);
      const bbox = data.solarPotential?.boundingBox ?? data.boundingBox;

      let boundingBox = { north: lat + 0.0003, south: lat - 0.0003, east: lng + 0.0004, west: lng - 0.0004 };
      if (bbox) {
        boundingBox = {
          north: bbox.ne?.latitude ?? bbox.north ?? boundingBox.north,
          south: bbox.sw?.latitude ?? bbox.south ?? boundingBox.south,
          east: bbox.ne?.longitude ?? bbox.east ?? boundingBox.east,
          west: bbox.sw?.longitude ?? bbox.west ?? boundingBox.west,
        };
      }

      return {
        totalArea: Math.round(totalArea * 10.764), // m2 -> ft2
        segments: segments.length,
        pitchDegrees,
        boundingBox,
        rawSegments: segments,
      };
    } catch (err) {
      console.warn('Solar API error:', err);
      return null;
    }
  }

  /**
   * Collect satellite, aerial, and street view images.
   */
  async collectImages(lat: number, lng: number, solarData?: SolarData | null): Promise<CollectedImage[]> {
    const images: CollectedImage[] = [];

    const pad = 0.00045;
    const bbox = solarData?.boundingBox ?? {
      north: lat + pad,
      south: lat - pad,
      east: lng + pad,
      west: lng - pad,
    };
    const west = (bbox.west - pad / 2).toFixed(6);
    const south = (bbox.south - pad / 2).toFixed(6);
    const east = (bbox.east + pad / 2).toFixed(6);
    const north = (bbox.north + pad / 2).toFixed(6);

    const googleSatUrl =
      `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}` +
      `&zoom=20&size=640x640&maptype=satellite&key=${GOOGLE_KEY}`;

    const esriUrl =
      `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export` +
      `?bbox=${west}%2C${south}%2C${east}%2C${north}` +
      `&bboxSR=4326&size=640%2C640&format=png&f=image`;

    const streetViewUrls = [0, 120, 240].map(
      (heading) =>
        `https://maps.googleapis.com/maps/api/streetview?size=640x640` +
        `&location=${lat},${lng}&heading=${heading}&pitch=30&fov=90&key=${GOOGLE_KEY}`
    );

    const fetches = await Promise.allSettled([
      fetchImageBase64(googleSatUrl).then((b64) =>
        images.push({ source: 'google_satellite', label: 'Google Satellite (zoom 20)', base64: b64, width: 640, height: 640 })
      ),
      fetchImageBase64(esriUrl, 'image/png').then((b64) =>
        images.push({ source: 'esri_aerial', label: 'Esri World Imagery (aerial)', base64: b64, width: 640, height: 640 })
      ),
      ...streetViewUrls.map((url, i) =>
        fetchImageBase64(url).then((b64) =>
          images.push({ source: `street_view_${i}`, label: `Street View (heading ${i * 120})`, base64: b64, width: 640, height: 640 })
        )
      ),
    ]);

    fetches.forEach((r, i) => {
      if (r.status === 'rejected') {
        const labels = ['Google Satellite', 'Esri Aerial', 'Street View 0', 'Street View 120', 'Street View 240'];
        console.warn(`Image fetch failed [${labels[i]}]:`, r.reason?.message);
      }
    });

    return images;
  }

  /**
   * Run all available AI engines in parallel.
   */
  async runAIEngines(
    images: CollectedImage[],
    solarData: SolarData | null,
    streetViewCount?: number,
    overheadCount?: number
  ): Promise<EngineResult[]> {
    const streetViews = images.filter(
      (img) => img.source.startsWith('street_view') || img.source.startsWith('uploaded')
    );
    const overhead = images.filter(
      (img) => !img.source.startsWith('street_view') && !img.source.startsWith('uploaded')
    );

    const svCount = streetViewCount ?? streetViews.length;
    const ohCount = overheadCount ?? overhead.length;

    const prompt = buildMeasurementPrompt(solarData, { streetView: svCount, overhead: ohCount });

    const hasVertex = !!(GOOGLE_SA_EMAIL && GOOGLE_SA_KEY);
    const hasClaude = !!ANTHROPIC_KEY;

    // Run primary engines in parallel
    const engine1Promise = hasVertex
      ? runVertexAI('gemini-2.0-flash', prompt, images, 0.4)
      : runGemini('gemini-2.0-flash', prompt, images, 0.4);

    const engine2Promise = hasClaude
      ? runClaude(prompt, images)
      : hasVertex
        ? runVertexAI('gemini-2.5-flash', prompt, images, 0.3)
        : new Promise<EngineResult>((resolve) =>
            setTimeout(() => runGemini('gemini-1.5-flash', prompt, images, 0.3).then(resolve), 2000)
          );

    const engine3Promise = runOllama(prompt, images);

    const engine4Promise = IS_VERCEL
      ? Promise.resolve(emptyResult('Ollama llava:7b (local)', 'Skipped on Vercel'))
      : runOllama(prompt, images, 'llava:7b');

    const [engine1, engine2, engine3, engine4] = await Promise.all([
      engine1Promise,
      engine2Promise,
      engine3Promise,
      engine4Promise,
    ]);

    return [engine1, engine2, engine3, engine4];
  }

  /**
   * Build consensus across engine results using Michael's Rule.
   */
  async buildConsensus(
    initialResults: EngineResult[],
    allEngines: EngineResult[],
    orderedImages: CollectedImage[],
    solarData: SolarData | null,
    prompt: string,
    qualityNotes: string[],
    hasVertex: boolean
  ): Promise<{
    measurements: MeasurementResult['measurements'];
    pitch: string;
    roofStyle: string;
    components: EngineResult['components'];
    overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
    allProviderResults: EngineResult[];
  }> {
    const metrics = ['ridges', 'rakes', 'valleys', 'eaves', 'hips'] as const;
    let allProviderResults = [...allEngines];
    const consensusResults: Record<string, ConsensusResult> = {};

    let extraEnginesRun = false;
    let extendedResults = initialResults;

    for (const metric of metrics) {
      const values = extendedResults.map((r) => ({
        engine: r.engine,
        value: sumLines(r[metric]),
      }));
      let consensus = applyConsensus(values);

      if (consensus.confidence !== 'HIGH' && !extraEnginesRun && initialResults.length >= 2) {
        // Running 2 additional engines for tie-breaking;
        const [engine4, engine5] = await Promise.all([
          hasVertex
            ? runVertexAI('gemini-2.5-flash', prompt, orderedImages, 0.1)
            : runGemini('gemini-2.5-flash', prompt, orderedImages, 0.1),
          hasVertex
            ? runVertexAI('gemini-2.0-flash', prompt, orderedImages, 0.3)
            : runGemini('gemini-1.5-flash', prompt, orderedImages, 0.4),
        ]);
        extraEnginesRun = true;
        extendedResults = [...initialResults, engine4, engine5];
        allProviderResults = [...allEngines, engine4, engine5];
        qualityNotes.push(`Ran 2 additional engines for consensus: ${engine4.engine}, ${engine5.engine}`);

        const extValues = extendedResults.map((r) => ({
          engine: r.engine,
          value: sumLines(r[metric]),
        }));
        consensus = applyConsensus(extValues);
      } else if (consensus.confidence !== 'HIGH' && extraEnginesRun) {
        const extValues = extendedResults.map((r) => ({
          engine: r.engine,
          value: sumLines(r[metric]),
        }));
        consensus = applyConsensus(extValues);
      }

      consensusResults[metric] = consensus;
    }

    // Overall confidence
    const confidences = Object.values(consensusResults).map((c) => c.confidence);
    let overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
    if (confidences.includes('LOW')) overallConfidence = 'LOW';
    else if (confidences.includes('MEDIUM')) overallConfidence = 'MEDIUM';

    // Consensus pitch
    const allPitches = extendedResults.flatMap((r) => r.pitches);
    const pitch = allPitches[0] ?? 'unknown';

    // Consensus roof style
    const styles = extendedResults.map((r) => r.roofStyle).filter((s) => s !== 'unknown');
    const roofStyle = mode(styles) ?? 'unknown';

    // Average components
    const validResults = extendedResults.filter((r) => !r.error);
    const avgComponents = {
      vents: Math.round(avg(validResults.map((r) => r.components.vents))),
      pipes: Math.round(avg(validResults.map((r) => r.components.pipes))),
      chimneys: Math.round(avg(validResults.map((r) => r.components.chimneys))),
      skylights: Math.round(avg(validResults.map((r) => r.components.skylights))),
      flashing: Math.round(avg(validResults.map((r) => r.components.flashing))),
    };

    function buildCategory(metric: 'ridges' | 'rakes' | 'valleys' | 'eaves' | 'hips'): MeasurementCategory {
      const c = consensusResults[metric];
      const sourceEngine = allProviderResults.find((r) => r.engine === c.usedEngines[0]);
      return {
        totalFt: c.value,
        count: sourceEngine?.[metric]?.length ?? 0,
        details: sourceEngine?.[metric] ?? [],
        confidence: c.confidence,
      };
    }

    return {
      measurements: {
        ridge: buildCategory('ridges'),
        rake: buildCategory('rakes'),
        valley: buildCategory('valleys'),
        eave: buildCategory('eaves'),
        hip: buildCategory('hips'),
      },
      pitch,
      roofStyle,
      components: avgComponents,
      overallConfidence,
      allProviderResults,
    };
  }

  /**
   * Save measurement result to Google Sheets via roof-report-service.
   */
  async saveMeasurement(result: MeasurementResult, leadId?: string): Promise<string> {
    const record = await roofReportService.storeReport(result, leadId);
    return record.reportId;
  }

  /**
   * Get available/configured AI engine status.
   */
  getEngineStatus(): { engine: string; available: boolean; reason?: string }[] {
    return [
      {
        engine: 'Vertex AI (Gemini)',
        available: !!(GOOGLE_SA_EMAIL && GOOGLE_SA_KEY),
        reason: !(GOOGLE_SA_EMAIL && GOOGLE_SA_KEY) ? 'GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY not set' : undefined,
      },
      {
        engine: 'Gemini AI Studio',
        available: !!GEMINI_KEY,
        reason: !GEMINI_KEY ? 'GEMINI_API_KEY not set' : undefined,
      },
      {
        engine: 'Claude (Anthropic)',
        available: !!ANTHROPIC_KEY,
        reason: !ANTHROPIC_KEY ? 'ANTHROPIC_API_KEY not set' : undefined,
      },
      {
        engine: 'Ollama (Local)',
        available: !IS_VERCEL,
        reason: IS_VERCEL ? 'Not available on Vercel (local only)' : undefined,
      },
    ];
  }

  private buildEmptyResponse(
    geo: GeoResult,
    solarData: SolarData | null,
    images: CollectedImage[],
    qualityNotes: string[],
    providerResults: EngineResult[]
  ): MeasurementResult {
    const emptyCategory: MeasurementCategory = { totalFt: 0, count: 0, details: [], confidence: 'LOW' };
    return {
      address: geo.formattedAddress,
      lat: geo.lat,
      lng: geo.lng,
      solarData,
      measurements: {
        ridge: emptyCategory,
        rake: emptyCategory,
        valley: emptyCategory,
        eave: emptyCategory,
        hip: emptyCategory,
      },
      pitch: 'unknown',
      roofStyle: 'unknown',
      components: { vents: 0, pipes: 0, chimneys: 0, skylights: 0, flashing: 0 },
      overallConfidence: 'LOW',
      qualityNotes,
      images,
      providerResults,
      needsMoreImages: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Export singleton
// ---------------------------------------------------------------------------

export const roofMeasureService = new RoofMeasureService();
