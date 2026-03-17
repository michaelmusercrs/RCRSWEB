/**
 * Roof Measurement Status API — /api/roof-measure/status
 *
 * GET: Health check — which AI engines are available/configured
 */

import { NextRequest, NextResponse } from 'next/server';
import { roofMeasureService } from '@/lib/roof-measure-service';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  const engines = roofMeasureService.getEngineStatus();
  const availableCount = engines.filter((e) => e.available).length;

  return NextResponse.json({
    status: availableCount >= 2 ? 'ready' : availableCount >= 1 ? 'degraded' : 'unavailable',
    message:
      availableCount >= 2
        ? `${availableCount} AI engines available — ready for measurements`
        : availableCount >= 1
          ? `Only ${availableCount} engine available — measurements may have lower confidence`
          : 'No AI engines configured — measurements will fail',
    engines,
    googleMapsKey: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    googleSheetsConfigured: !!(process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID),
    timestamp: new Date().toISOString(),
  });
}
