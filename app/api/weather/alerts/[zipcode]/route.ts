/**
 * Weather Alerts API
 *
 * GET /api/weather/alerts/[zipcode]
 *
 * Returns active weather alerts for the specified zip code.
 * Includes hail alerts, severe weather warnings, and storm risk indicators.
 *
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     alerts: WeatherAlert[],
 *     stormRisk: StormRisk,
 *     hailReports?: HailReport[]
 *   } | null,
 *   error?: string
 * }
 *
 * Query Parameters:
 * - includeHailReports: boolean (default: false) - Include recent hail reports in the area
 * - daysBack: number (default: 30) - Days to look back for hail reports
 * - radiusMiles: number (default: 50) - Search radius for hail reports
 */

import { NextResponse } from 'next/server';
import { weatherService } from '@/lib/weather-service';
import { cache, CACHE_TTL } from '@/lib/cache';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ zipcode: string }> }
) {
  try {
    const { zipcode } = await params;
    const { searchParams } = new URL(request.url);

    // Validate zip code format
    const cleanZip = zipcode.replace(/\D/g, '');
    if (cleanZip.length !== 5) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid zip code format. Please provide a 5-digit US zip code.',
          data: null,
        },
        { status: 400 }
      );
    }

    // Parse query parameters
    const includeHailReports = searchParams.get('includeHailReports') === 'true';
    const daysBack = parseInt(searchParams.get('daysBack') || '30', 10);
    const radiusMiles = parseInt(searchParams.get('radiusMiles') || '50', 10);

    // Check cache first (without hail reports - those are cached separately)
    const cacheKey = `weather:alerts:${cleanZip}:hail=${includeHailReports}:days=${daysBack}:radius=${radiusMiles}`;
    const cached = cache.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch weather data to get alerts and storm risk
    const weatherData = await weatherService.getWeatherByZip(cleanZip);

    if (!weatherData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to fetch alert data for this location.',
          data: null,
        },
        { status: 404 }
      );
    }

    // Build response
    const responseData: {
      alerts: typeof weatherData.alerts;
      stormRisk: typeof weatherData.stormRisk;
      hasActiveAlerts: boolean;
      hasHailRisk: boolean;
      affectsRoofing: boolean;
      hailReports?: Awaited<ReturnType<typeof weatherService.getHailReportsByZip>>;
    } = {
      alerts: weatherData.alerts,
      stormRisk: weatherData.stormRisk,
      hasActiveAlerts: weatherData.alerts.length > 0,
      hasHailRisk: weatherData.alerts.some(a => a.isHailRelated),
      affectsRoofing: weatherData.alerts.some(a => a.affectsRoofing),
    };

    // Include hail reports if requested
    if (includeHailReports) {
      try {
        const hailReports = await weatherService.getHailReportsByZip(cleanZip, daysBack, radiusMiles);
        responseData.hailReports = hailReports;
      } catch (hailError) {
        console.error('Error fetching hail reports:', hailError);
        // Continue without hail reports
      }
    }

    const response = {
      success: true,
      data: responseData,
      zipcode: cleanZip,
      location: weatherData.location,
    };
    cache.set(cacheKey, response, CACHE_TTL.MEDIUM); // 5 minutes
    return NextResponse.json(response);
  } catch (error) {
    console.error('Weather alerts API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch alert data. Please try again later.',
        data: null,
      },
      { status: 500 }
    );
  }
}
