import { NextRequest, NextResponse } from 'next/server';
import { analyzeMethodConsistency, autoCalibrate, type AICalibrationResult } from '@/lib/roof-calibration';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const TEST_ADDRESSES = [
  '1501 6th Ave SE, Decatur, AL 35601',
  '2305 Danville Rd SW, Decatur, AL 35603',
  '1808 Stratford Rd SE, Decatur, AL 35601',
  '115 Brookhaven Way, Hartselle, AL 35640',
  '2411 Covemont Dr SE, Huntsville, AL 35801',
];

/**
 * POST /api/roof-measure/test-mode
 * 
 * Runs all 5 test addresses through the pipeline, compares method results,
 * and auto-generates initial accuracy scores.
 */
export async function POST(request: NextRequest) {
  const baseUrl = request.nextUrl.origin;
  const results: { address: string; aiResults: AICalibrationResult[]; error?: string }[] = [];

  for (const address of TEST_ADDRESSES) {
    try {
      console.log(`Test mode: measuring ${address}...`);
      const res = await fetch(`${baseUrl}/api/roof-measure?address=${encodeURIComponent(address)}`, {
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) {
        results.push({ address, aiResults: [], error: `HTTP ${res.status}` });
        continue;
      }
      const data = await res.json();

      // Extract per-method AI results from the pipeline response
      const aiResults: AICalibrationResult[] = (data.pipeline?.allProviderResults || []).map(
        (r: { name: string; totalRidge: number; totalRake: number; totalEave: number; totalValley?: number; totalHip?: number; method?: string; provider?: string; model?: string; imageSet?: string }) => ({
          method: r.method || r.name,
          provider: r.provider || extractProvider(r.name),
          model: r.model || extractModel(r.name),
          imageSet: r.imageSet || extractImageSet(r.name),
          ridge: r.totalRidge || 0,
          rake: r.totalRake || 0,
          valley: r.totalValley || 0,
          eave: r.totalEave || 0,
          hip: r.totalHip || 0,
        })
      );

      results.push({ address, aiResults });
    } catch (e: unknown) {
      results.push({ address, aiResults: [], error: String(e) });
    }
  }

  // Analyze cross-job consistency
  const validResults = results.filter(r => r.aiResults.length > 0);
  const consistency = analyzeMethodConsistency(validResults);

  // Auto-calibrate based on consistency
  const calibrationData = autoCalibrate(validResults);

  // Build report
  const report = {
    addresses: results.map(r => ({
      address: r.address,
      methodCount: r.aiResults.length,
      error: r.error || null,
      methods: r.aiResults.map(ai => ({
        method: ai.method,
        ridge: ai.ridge,
        rake: ai.rake,
        valley: ai.valley,
        eave: ai.eave,
        hip: ai.hip,
      })),
    })),
    methodConsistency: consistency,
    methodAccuracy: calibrationData.methodAccuracy,
    summary: {
      addressesTested: results.length,
      addressesSucceeded: validResults.length,
      methodsAnalyzed: Object.keys(consistency).length,
      reliableMethods: Object.entries(consistency).filter(([, s]) => (s as any).reliable).map(([m]) => m),
      unreliableMethods: Object.entries(consistency).filter(([, s]) => !(s as any).reliable).map(([m]) => m),
    },
  };

  return NextResponse.json(report);
}

// Helper: extract provider/model/imageSet from pass names like "Pass1-Gemini-GoogleSat"
function extractProvider(name: string): string {
  if (name.includes('Ollama')) return 'ollama';
  if (name.includes('Vertex')) return 'vertex';
  if (name.includes('Gemini')) return 'ai-studio';
  return 'unknown';
}

function extractModel(name: string): string {
  if (name.includes('Ollama')) return 'llava:7b';
  if (name.includes('GeminiVerify')) return 'gemini-verify';
  if (name.includes('Gemini')) return 'gemini';
  return 'unknown';
}

function extractImageSet(name: string): string {
  if (name.includes('Esri')) return 'esri';
  if (name.includes('StreetView') || name.includes('-SV')) return 'street-view';
  if (name.includes('GoogleSat')) return 'google-sat';
  if (name.includes('AllSat')) return 'all-satellite';
  return 'mixed';
}

/**
 * GET /api/roof-measure/test-mode
 * Returns the list of test addresses.
 */
export async function GET() {
  return NextResponse.json({ addresses: TEST_ADDRESSES });
}
