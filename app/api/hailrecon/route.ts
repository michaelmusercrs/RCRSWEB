import { NextRequest, NextResponse } from 'next/server';
import { hailReconService } from '@/lib/hailrecon-service';

// GET - Fetch HailRecon data for a location
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '');
    const lon = parseFloat(searchParams.get('lon') || '');
    const address = searchParams.get('address') || '';
    const radius = parseInt(searchParams.get('radius') || '15');

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json(
        { success: false, error: 'lat and lon query parameters are required' },
        { status: 400 }
      );
    }

    if (!hailReconService.isConfigured()) {
      return NextResponse.json(
        { success: false, error: 'HailRecon is not configured', data: null },
        { status: 200 }
      );
    }

    const data = await hailReconService.getPropertyHailHistory(address, lat, lon, radius);

    return NextResponse.json({
      success: true,
      configured: true,
      data,
    });
  } catch (error) {
    console.error('HailRecon API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch HailRecon data' },
      { status: 500 }
    );
  }
}
