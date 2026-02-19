import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const IS_VERCEL = !!process.env.VERCEL;

interface CheckResult {
  status: 'ok' | 'error' | 'missing' | 'skipped';
  detail?: string;
  ms?: number;
}

async function checkGeocode(): Promise<CheckResult> {
  if (!GOOGLE_KEY) return { status: 'missing', detail: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set' };
  const start = Date.now();
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent('1600 Amphitheatre Parkway, Mountain View, CA')}&key=${GOOGLE_KEY}`);
    const data = await res.json();
    if (data.results?.length > 0) return { status: 'ok', ms: Date.now() - start };
    return { status: 'error', detail: data.error_message || 'No results', ms: Date.now() - start };
  } catch (e) { return { status: 'error', detail: String(e), ms: Date.now() - start }; }
}

async function checkSolarApi(): Promise<CheckResult> {
  if (!GOOGLE_KEY) return { status: 'missing', detail: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set' };
  const start = Date.now();
  try {
    const res = await fetch(`https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=34.6059&location.longitude=-86.9833&requiredQuality=BASE&key=${GOOGLE_KEY}`);
    const data = await res.json();
    if (data.error) return { status: 'error', detail: `${data.error.code}: ${data.error.message}`, ms: Date.now() - start };
    if (data.solarPotential) return { status: 'ok', ms: Date.now() - start };
    return { status: 'error', detail: 'No solar data returned', ms: Date.now() - start };
  } catch (e) { return { status: 'error', detail: String(e), ms: Date.now() - start }; }
}

async function checkStaticMaps(): Promise<CheckResult> {
  if (!GOOGLE_KEY) return { status: 'missing', detail: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set' };
  const start = Date.now();
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/staticmap?center=34.6059,-86.9833&zoom=20&size=100x100&maptype=satellite&key=${GOOGLE_KEY}`);
    if (res.ok && res.headers.get('content-type')?.includes('image')) return { status: 'ok', ms: Date.now() - start };
    return { status: 'error', detail: `HTTP ${res.status}`, ms: Date.now() - start };
  } catch (e) { return { status: 'error', detail: String(e), ms: Date.now() - start }; }
}

async function checkGemini(): Promise<CheckResult> {
  if (!GEMINI_KEY) return { status: 'missing', detail: 'GEMINI_API_KEY not set — AI analysis will use geometric fallback only' };
  const start = Date.now();
  const models = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
  const available: string[] = [];
  const limited: string[] = [];
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply OK' }] }] }) }
      );
      if (res.ok) available.push(model);
      else if (res.status === 429) limited.push(model);
    } catch { limited.push(model); }
  }
  if (available.length > 0) return { status: 'ok', detail: `Available: ${available.join(', ')}${limited.length ? ` | Rate-limited: ${limited.join(', ')}` : ''}`, ms: Date.now() - start };
  return { status: 'error', detail: `All models rate-limited: ${limited.join(', ')}`, ms: Date.now() - start };
}

async function checkOllama(): Promise<CheckResult> {
  if (IS_VERCEL) return { status: 'skipped', detail: 'Ollama not available on Vercel' };
  const start = Date.now();
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { status: 'error', detail: `HTTP ${res.status}`, ms: Date.now() - start };
    const data = await res.json();
    const models = (data.models || []).map((m: { name: string }) => m.name).join(', ');
    const hasLlava = models.includes('llava');
    return { 
      status: hasLlava ? 'ok' : 'error', 
      detail: hasLlava ? `Models: ${models}` : `llava not found. Available: ${models || 'none'}`,
      ms: Date.now() - start 
    };
  } catch (e) { return { status: 'error', detail: `Ollama not running: ${String(e).slice(0, 100)}`, ms: Date.now() - start }; }
}

export async function GET() {
  const [geocode, solar, staticMaps, gemini, ollama] = await Promise.all([
    checkGeocode(), checkSolarApi(), checkStaticMaps(), checkGemini(), checkOllama(),
  ]);

  const allChecks = { geocode, solar, staticMaps, gemini, ollama };
  const criticalOk = geocode.status === 'ok' && staticMaps.status === 'ok';
  const aiAvailable = gemini.status === 'ok' || ollama.status === 'ok';

  return NextResponse.json({
    overall: criticalOk ? (aiAvailable ? 'ready' : 'degraded') : 'broken',
    message: !criticalOk 
      ? 'Google Maps APIs not working — tool will fail'
      : !aiAvailable 
        ? 'No AI providers available — will use geometric estimation (still works, less accurate)'
        : 'All systems operational',
    checks: allChecks,
    timestamp: new Date().toISOString(),
  });
}
