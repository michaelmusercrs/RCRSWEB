/**
 * Huntsville-area 5-day forecast.
 *
 * READS FROM the master sheet's Weather_Forecast_Cache tab — a cron
 * (/api/cron/refresh-weather-forecast) writes the latest forecast there
 * every ~60 min. That means ONE NWS fetch per refresh interval, regardless
 * of how many customers view their portal in that window.
 *
 * Fallback: if the sheet row is missing or older than 4 hours (cron skipped
 * or NWS was down at refresh time), we'll do a one-off live fetch and
 * return that — keeps the customer portal from showing stale data even if
 * the refresh pipeline broke.
 *
 * Future: extend lib/weather-locations.ts with zip-code-precise entries
 * and call getForecastByLocation(zipKey) here instead of always going to
 * the Huntsville row.
 */

import { googleSheetsService } from './google-sheets-service';

const STALE_AFTER_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface ForecastPeriod {
  name: string;
  isDaytime: boolean;
  tempF: number;
  tempUnit: 'F';
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  icon: string;
  startTime: string;
}

export interface FiveDayForecast {
  location: string;
  generatedAt: string;
  periods: ForecastPeriod[];
}

const HUNTSVILLE_KEY = 'huntsville-al';
const HUNTSVILLE_LAT = 34.7304;
const HUNTSVILLE_LON = -86.5861;
const USER_AGENT = 'RCRSCustomerPortal/1.0 (michael@rcrsal.com)';

export async function getHuntsvilleForecast(): Promise<FiveDayForecast | null> {
  return getForecastByLocation(HUNTSVILLE_KEY);
}

/**
 * Read the cached forecast for a given location key from the master sheet.
 * Falls back to a live NWS fetch if the cache row is missing or stale.
 *
 * For zip-code-precise forecasts later: add the location to
 * lib/weather-locations.ts and call getForecastByLocation(zipKey).
 */
export async function getForecastByLocation(locationKey: string): Promise<FiveDayForecast | null> {
  try {
    const cached = await googleSheetsService.getWeatherForecastCache(locationKey);
    if (cached?.forecastJson) {
      const fetchedAt = new Date(cached.fetchedAt).getTime();
      const age = Date.now() - fetchedAt;
      if (!isNaN(fetchedAt) && age < STALE_AFTER_MS) {
        try {
          return JSON.parse(cached.forecastJson) as FiveDayForecast;
        } catch {
          // Malformed — fall through to live fetch
        }
      }
      // Cache exists but stale — fall through (cron should've refreshed,
      // but in the meantime do a one-off live fetch so customer doesn't
      // see stale data)
    }
  } catch (err) {
    console.warn('[Huntsville Forecast] sheet read failed, falling back to live NWS:', err);
  }

  // Live fallback — only fires when the cache is empty or stale
  return liveFetchNWS(HUNTSVILLE_LAT, HUNTSVILLE_LON, 'Huntsville, AL');
}

async function liveFetchNWS(lat: number, lng: number, locationName: string): Promise<FiveDayForecast | null> {
  try {
    const pointsRes = await fetch(`https://api.weather.gov/points/${lat},${lng}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
      cache: 'no-store',
    });
    if (!pointsRes.ok) return null;
    const pointsJson = await pointsRes.json();
    const forecastUrl = pointsJson?.properties?.forecast;
    if (!forecastUrl) return null;

    const fcRes = await fetch(forecastUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
      cache: 'no-store',
    });
    if (!fcRes.ok) return null;
    const fcJson = await fcRes.json();
    const periods: ForecastPeriod[] = (fcJson?.properties?.periods || []).map((p: Record<string, unknown>) => ({
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
    return {
      location: locationName,
      generatedAt: new Date().toISOString(),
      periods: periods.slice(0, 10),
    };
  } catch (err) {
    console.warn('[Huntsville Forecast] live NWS fetch failed:', err);
    return null;
  }
}

export function invalidateForecastCache(): void {
  // No in-memory cache anymore — the sheet IS the cache. Kept as a no-op
  // for backwards compat with any caller that imported this.
}
