/**
 * Weather Forecast API
 *
 * GET /api/weather/forecast/[zipcode]
 *
 * Returns 7-day weather forecast for the specified zip code.
 * Includes current conditions, daily forecasts, and workability assessments.
 *
 * Response:
 * {
 *   success: boolean,
 *   data: WeatherData | null,
 *   error?: string
 * }
 */

import { NextResponse } from 'next/server';
import { weatherService } from '@/lib/weather-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ zipcode: string }> }
) {
  try {
    const { zipcode } = await params;

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

    // Fetch weather data
    const weatherData = await weatherService.getWeatherByZip(cleanZip);

    if (!weatherData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to fetch weather data for this location.',
          data: null,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: weatherData,
      zipcode: cleanZip,
    });
  } catch (error) {
    console.error('Weather forecast API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch weather data. Please try again later.',
        data: null,
      },
      { status: 500 }
    );
  }
}
