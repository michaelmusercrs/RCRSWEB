/**
 * RCRS Command Center - Meeting Weather API
 *
 * Fetches current conditions and 7-day forecast for Decatur, AL (RCRS home base)
 * to display in the Monday meeting presentation. Uses Open-Meteo (free, no API key).
 *
 * GET /api/command-center/meetings/weather
 * Returns current conditions, 7-day forecast with workability flags, and alerts.
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextResponse } from 'next/server';
import { weatherService } from '@/lib/weather-service';

export async function GET() {
  try {
    // Fetch weather for Decatur, AL (RCRS home base, zip 35601)
    const weather = await weatherService.getWeatherByZip('35601');

    // Format for meeting presentation
    const meetingWeather = {
      current: {
        temperature: weather.current.temp,
        feelsLike: weather.current.feelsLike,
        description: weather.current.condition,
        humidity: weather.current.humidity,
        windSpeed: weather.current.windSpeed,
        windGust: weather.current.windGust,
        icon: weather.current.icon,
        isWorkable: weather.current.isWorkable,
        workabilityReason: weather.current.workabilityReason,
      },
      // This week's forecast (for installation scheduling)
      weekForecast: weather.forecast.slice(0, 7).map(day => ({
        date: day.date,
        dayName: day.dayOfWeek,
        high: day.high,
        low: day.low,
        description: day.condition,
        precipChance: day.precipChance,
        windSpeed: day.windSpeed,
        windGust: day.windGust,
        uvIndex: day.uvIndex,
        icon: day.icon,
        isWorkDay: day.isWorkable,
        workabilityReason: day.workabilityReason,
      })),
      // Count of workable days this week
      workableDays: weather.forecast.slice(0, 7).filter(d => d.isWorkable).length,
      alerts: weather.alerts,
      stormRisk: weather.stormRisk,
      location: weather.location,
      fetchedAt: weather.lastUpdated,
    };

    return NextResponse.json({
      success: true,
      data: meetingWeather,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, max-age=1800' }, // 30 min cache
    });
  } catch (error) {
    console.error('[Meeting Weather] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch weather data',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
