/**
 * NOAA/NWS 5-day forecast for the Huntsville area.
 * Free, no API key required (User-Agent header is the only requirement).
 *
 * Two-step API:
 *   1. GET /points/{lat},{lon} → returns the gridpoint forecast URL
 *   2. GET that forecast URL → returns 7-day forecast in 12-hour periods
 *
 * Cached for 1 hour. The forecast doesn't change frequently and we don't
 * want to pound the NWS API on every customer-portal pageview.
 */

const HUNTSVILLE_LAT = 34.7304;
const HUNTSVILLE_LON = -86.5861;
const USER_AGENT = 'RCRSCustomerPortal/1.0 (michael@rcrsal.com)';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface ForecastPeriod {
  name: string;            // "Tonight", "Wednesday", etc.
  isDaytime: boolean;
  tempF: number;
  tempUnit: 'F';
  windSpeed: string;
  windDirection: string;
  shortForecast: string;   // "Sunny", "Chance of rain showers", etc.
  detailedForecast: string;
  icon: string;
  startTime: string;       // ISO
}

export interface FiveDayForecast {
  location: string;
  generatedAt: string;
  periods: ForecastPeriod[];
}

let _cache: { value: FiveDayForecast; at: number } | null = null;

export async function getHuntsvilleForecast(): Promise<FiveDayForecast | null> {
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.value;

  try {
    // Step 1: get the gridpoint endpoint for Huntsville
    const pointsRes = await fetch(`https://api.weather.gov/points/${HUNTSVILLE_LAT},${HUNTSVILLE_LON}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
      cache: 'no-store',
    });
    if (!pointsRes.ok) {
      console.warn('[Huntsville Forecast] points call failed:', pointsRes.status);
      return null;
    }
    const pointsJson = await pointsRes.json();
    const forecastUrl = pointsJson?.properties?.forecast;
    if (!forecastUrl) return null;

    // Step 2: fetch the actual forecast
    const fcRes = await fetch(forecastUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
      cache: 'no-store',
    });
    if (!fcRes.ok) {
      console.warn('[Huntsville Forecast] forecast call failed:', fcRes.status);
      return null;
    }
    const fcJson = await fcRes.json();
    const allPeriods: ForecastPeriod[] = (fcJson?.properties?.periods || []).map((p: Record<string, unknown>) => ({
      name: String(p.name || ''),
      isDaytime: Boolean(p.isDaytime),
      tempF: Number(p.temperature || 0),
      tempUnit: 'F',
      windSpeed: String(p.windSpeed || ''),
      windDirection: String(p.windDirection || ''),
      shortForecast: String(p.shortForecast || ''),
      detailedForecast: String(p.detailedForecast || ''),
      icon: String(p.icon || ''),
      startTime: String(p.startTime || ''),
    }));

    // Keep first 10 periods = roughly 5 days of day/night pairs
    const fiveDay: FiveDayForecast = {
      location: 'Huntsville, AL',
      generatedAt: new Date().toISOString(),
      periods: allPeriods.slice(0, 10),
    };
    _cache = { value: fiveDay, at: Date.now() };
    return fiveDay;
  } catch (err) {
    console.warn('[Huntsville Forecast] fetch failed:', err);
    return null;
  }
}

export function invalidateForecastCache(): void {
  _cache = null;
}
