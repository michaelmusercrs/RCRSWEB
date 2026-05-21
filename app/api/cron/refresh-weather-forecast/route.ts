// Cron: refresh weather forecast cache
//
// Runs hourly. For each active location, fetch NWS forecast and write to
// Weather_Forecast_Cache sheet. One fetch per refresh, regardless of how
// many customers view their portal in that window.
//
// Idempotent: skips locations whose nextRefreshAt is still in the future.
// Locations defined in lib/weather-locations.ts — extend that list to add
// zip-code-precise forecasts later (today: just Huntsville).

import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-response';
import { withCronLock } from '@/lib/cron-lock';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { WEATHER_LOCATIONS } from '@/lib/weather-locations';
import { getCustomerPortalConfig } from '@/lib/customer-portal-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const USER_AGENT = 'RCRSCustomerPortal/1.0 (michael@rcrsal.com)';
const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

async function fetchNWS(lat: number, lng: number) {
  const pointsRes = await fetch(`https://api.weather.gov/points/${lat},${lng}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
    cache: 'no-store',
  });
  if (!pointsRes.ok) throw new Error(`NWS points ${pointsRes.status}`);
  const pointsJson = await pointsRes.json();
  const forecastUrl = pointsJson?.properties?.forecast;
  if (!forecastUrl) throw new Error('NWS points: no forecast URL');

  const fcRes = await fetch(forecastUrl, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
    cache: 'no-store',
  });
  if (!fcRes.ok) throw new Error(`NWS forecast ${fcRes.status}`);
  const fcJson = await fcRes.json();
  const allPeriods = (fcJson?.properties?.periods || []).map((p: Record<string, unknown>) => ({
    name: String(p.name || ''),
    isDaytime: Boolean(p.isDaytime),
    tempF: Number(p.temperature || 0),
    tempUnit: 'F' as const,
    windSpeed: String(p.windSpeed || ''),
    windDirection: String(p.windDirection || ''),
    shortForecast: String(p.shortForecast || ''),
    detailedForecast: String(p.detailedForecast || ''),
    icon: String(p.icon || ''),
    startTime: String(p.startTime || ''),
  }));
  return allPeriods.slice(0, 10);
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return apiError('Unauthorized', 401);

  return withCronLock('refresh-weather-forecast', { staleMinutes: 10 }, async () => {
    const start = Date.now();
    const cfg = getCustomerPortalConfig();
    const now = new Date();
    const results: Array<{ locationKey: string; status: string; error?: string }> = [];

    for (const loc of WEATHER_LOCATIONS) {
      try {
        // Check existing — skip if not yet due
        const existing = await googleSheetsService.getWeatherForecastCache(loc.locationKey);
        if (existing?.nextRefreshAt) {
          const due = new Date(existing.nextRefreshAt).getTime();
          if (!isNaN(due) && due > now.getTime()) {
            results.push({ locationKey: loc.locationKey, status: 'skipped-not-due' });
            continue;
          }
        }

        const periods = await fetchNWS(loc.lat, loc.lng);
        const forecast = {
          location: loc.displayName,
          generatedAt: now.toISOString(),
          periods,
        };

        await googleSheetsService.upsertWeatherForecastCache({
          locationKey: loc.locationKey,
          displayName: loc.displayName,
          lat: String(loc.lat),
          lng: String(loc.lng),
          forecastJson: JSON.stringify(forecast),
          disclaimer: cfg.weatherDisclaimer,
          fetchedAt: now.toISOString(),
          nextRefreshAt: new Date(now.getTime() + REFRESH_INTERVAL_MS).toISOString(),
          source: 'NOAA-NWS',
        });
        results.push({ locationKey: loc.locationKey, status: 'refreshed' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ locationKey: loc.locationKey, status: 'error', error: msg });
        console.warn(`[weather-cron] ${loc.locationKey}:`, msg);
      }
    }

    try {
      const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
      const summary = `${results.filter(r => r.status === 'refreshed').length} refreshed, ${results.filter(r => r.status === 'skipped-not-due').length} skipped, ${results.filter(r => r.status === 'error').length} errors`;
      await recordCronHeartbeat('refresh-weather-forecast', 'success', Date.now() - start, summary);
    } catch { /* heartbeat */ }

    return NextResponse.json({ success: true, results });
  });
}
