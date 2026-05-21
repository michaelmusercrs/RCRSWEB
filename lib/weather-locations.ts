/**
 * Active weather forecast locations.
 *
 * Today: just Huntsville (one row in Weather_Forecast_Cache).
 * Future: extend to zip-code-precise by adding entries here. The cron
 * iterates this list and one row per entry gets refreshed each cycle.
 *
 * To add a zip code:
 *   { locationKey: '35801', displayName: '35801 (downtown Huntsville)',
 *     lat: 34.7287, lng: -86.5778 }
 *
 * NWS API accepts any lat/lng in the US, so no per-zip API config needed.
 */

export interface WeatherLocation {
  locationKey: string;
  displayName: string;
  lat: number;
  lng: number;
}

export const WEATHER_LOCATIONS: WeatherLocation[] = [
  {
    locationKey: 'huntsville-al',
    displayName: 'Huntsville, AL',
    lat: 34.7304,
    lng: -86.5861,
  },
  // Future entries (commented out for reference):
  // { locationKey: '35801', displayName: '35801', lat: 34.7287, lng: -86.5778 },
  // { locationKey: '35803', displayName: '35803', lat: 34.6601, lng: -86.5497 },
  // { locationKey: '35640', displayName: '35640 Hartselle', lat: 34.4467, lng: -86.9358 },
  // { locationKey: '35601', displayName: '35601 Decatur', lat: 34.6024, lng: -86.9844 },
];

export function findLocationByKey(key: string): WeatherLocation | null {
  return WEATHER_LOCATIONS.find(l => l.locationKey === key) || null;
}
