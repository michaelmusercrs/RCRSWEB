import { NextRequest, NextResponse } from 'next/server';
import { generateEagleViewXml } from '@/lib/eagleview-export';

export const dynamic = 'force-dynamic';

/**
 * POST /api/roof-measure/export
 * 
 * Accepts a roof measurement report JSON and returns EagleView-compatible XML.
 * Used for JobNimbus CRM sync.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.address || !body.measurements) {
      return NextResponse.json({ error: 'Missing address or measurements' }, { status: 400 });
    }

    const xml = generateEagleViewXml({
      address: body.address,
      lat: body.lat || 0,
      lng: body.lng || 0,
      generatedAt: body.generatedAt || new Date().toISOString(),
      totalRoofAreaSqFt: body.solarData?.totalRoofAreaSqFt || 0,
      measurements: body.measurements,
      components: body.components || { flashing: [], transitions: [], vents: [], pipes: [], chimneys: [], skylights: [] },
      overallConfidence: body.overallConfidence || 'LOW',
      overrides: body.overrides,
    });

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="roof-report-${encodeURIComponent(body.address || 'unknown')}.xml"`,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
