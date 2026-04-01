/**
 * HailRecon Service
 *
 * Integrates with HailRecon (Interactive Hail Maps) API for historical
 * hail data going back to 2011. Provides property-level and area-level
 * hail history lookup.
 *
 * API authentication uses API key + secret pair.
 * Includes 24-hour in-memory cache per address.
 * Gracefully degrades when API is not configured or unavailable.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const HAILRECON_API_KEY = process.env.HAILRECON_API_KEY || '';
const HAILRECON_API_SECRET = process.env.HAILRECON_API_SECRET || '';
const HAILRECON_BASE_URL = 'https://api.hailrecon.com';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HailReconEvent {
  date: string;
  hailSize: number; // inches
  hailSizeLabel: string; // e.g. "1.75 inch (golf ball)"
  latitude: number;
  longitude: number;
  distance: number; // miles from queried location
  source: string;
  location: string;
  county: string;
  state: string;
}

export interface HailReconPropertyReport {
  address: string;
  latitude: number;
  longitude: number;
  totalStorms: number;
  largestHailSize: number;
  largestHailSizeLabel: string;
  mostRecentDate: string;
  events: HailReconEvent[];
  dataRange: { start: string; end: string };
  generatedAt: string;
}

/** Raw API response shape from HailRecon (varies by endpoint) */
interface HailReconApiRawEvent {
  date?: string;
  event_date?: string;
  timestamp?: string;
  hail_size?: string | number;
  size?: string | number;
  magnitude?: string | number;
  hailSize?: string | number;
  latitude?: string | number;
  lat?: string | number;
  longitude?: string | number;
  lon?: string | number;
  lng?: string | number;
  distance?: string | number;
  distance_miles?: string | number;
  source?: string;
  location?: string;
  city?: string;
  county?: string;
  state?: string;
}

interface HailReconApiResponse {
  events?: HailReconApiRawEvent[];
  hail_events?: HailReconApiRawEvent[];
  results?: HailReconApiRawEvent[];
  data?: HailReconApiRawEvent[];
  total_storms?: number;
  totalStorms?: number;
  data_range?: { start?: string; end?: string };
  startDate?: string;
  endDate?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: HailReconPropertyReport;
  timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Hail size labels
// ---------------------------------------------------------------------------

function getHailSizeLabel(size: number): string {
  if (size >= 4.5) return `${size}" (softball+)`;
  if (size >= 2.75) return `${size}" (baseball)`;
  if (size >= 2.0) return `${size}" (hen egg)`;
  if (size >= 1.75) return `${size}" (golf ball)`;
  if (size >= 1.5) return `${size}" (ping pong)`;
  if (size >= 1.0) return `${size}" (quarter)`;
  if (size >= 0.75) return `${size}" (penny)`;
  if (size >= 0.5) return `${size}" (marble)`;
  return `${size}" (pea)`;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class HailReconService {
  private cache = new Map<string, CacheEntry>();

  isConfigured(): boolean {
    return !!(HAILRECON_API_KEY && HAILRECON_API_SECRET);
  }

  private getCacheKey(lat: number, lon: number): string {
    return `${lat.toFixed(4)},${lon.toFixed(4)}`;
  }

  private getCached(key: string): HailReconPropertyReport | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache(key: string, data: HailReconPropertyReport): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    // Evict old entries when cache grows too large
    if (this.cache.size > 200) {
      const oldest = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < 50; i++) {
        this.cache.delete(oldest[i][0]);
      }
    }
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': HAILRECON_API_KEY,
      'X-API-Secret': HAILRECON_API_SECRET,
      'Authorization': `Bearer ${HAILRECON_API_KEY}`,
    };
  }

  /**
   * Fetch hail history for a specific property / location.
   * Tries multiple endpoint patterns since API docs aren't publicly browsable.
   */
  async getPropertyHailHistory(
    address: string,
    lat: number,
    lon: number,
    radiusMiles: number = 15
  ): Promise<HailReconPropertyReport | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const cacheKey = this.getCacheKey(lat, lon);
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    // Try known endpoint patterns
    const endpoints = [
      {
        url: `${HAILRECON_BASE_URL}/api/v1/property/hail`,
        body: { address, latitude: lat, longitude: lon, radius: radiusMiles },
      },
      {
        url: `${HAILRECON_BASE_URL}/api/v1/hail/search`,
        body: { lat, lon, radius_miles: radiusMiles, address },
      },
      {
        url: `${HAILRECON_BASE_URL}/v1/hail`,
        body: { latitude: lat, longitude: lon, radius: radiusMiles },
      },
      {
        url: `${HAILRECON_BASE_URL}/api/property`,
        body: { address, lat, lng: lon, radius: radiusMiles },
      },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(endpoint.body),
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const data = await response.json();
          const report = this.normalizeResponse(data, address, lat, lon);
          if (report) {
            this.setCache(cacheKey, report);
            return report;
          }
        }

        // Also try GET with query params
        const params = new URLSearchParams({
          lat: String(lat),
          lon: String(lon),
          radius: String(radiusMiles),
          api_key: HAILRECON_API_KEY,
        });

        const getUrl = endpoint.url.replace('/property/hail', '/hail').replace('/hail/search', '/hail');
        const getResponse = await fetch(`${getUrl}?${params}`, {
          method: 'GET',
          headers: this.getAuthHeaders(),
          signal: AbortSignal.timeout(10000),
        });

        if (getResponse.ok) {
          const data = await getResponse.json();
          const report = this.normalizeResponse(data, address, lat, lon);
          if (report) {
            this.setCache(cacheKey, report);
            return report;
          }
        }
      } catch (error) {
        // Continue to next endpoint
      }
    }

    return null;
  }

  /**
   * Fetch hail history for a broader area (used in command center / area reports).
   */
  async getAreaHailHistory(
    lat: number,
    lon: number,
    radiusMiles: number = 50
  ): Promise<HailReconPropertyReport | null> {
    return this.getPropertyHailHistory('Area Search', lat, lon, radiusMiles);
  }

  /**
   * Normalize various possible API response formats into our standard type.
   */
  private normalizeResponse(
    data: HailReconApiResponse,
    address: string,
    lat: number,
    lon: number
  ): HailReconPropertyReport | null {
    if (!data) return null;

    try {
      // Handle various response structures
      const events: HailReconEvent[] = [];
      const rawEvents = data.events || data.hail_events || data.results || data.data || [];

      if (Array.isArray(rawEvents)) {
        for (const evt of rawEvents) {
          const size = parseFloat(String(evt.hail_size || evt.size || evt.magnitude || evt.hailSize || 0));
          events.push({
            date: String(evt.date || evt.event_date || evt.timestamp || ''),
            hailSize: size,
            hailSizeLabel: getHailSizeLabel(size),
            latitude: parseFloat(String(evt.latitude || evt.lat || 0)),
            longitude: parseFloat(String(evt.longitude || evt.lon || evt.lng || 0)),
            distance: parseFloat(String(evt.distance || evt.distance_miles || 0)),
            source: evt.source || 'HailRecon',
            location: evt.location || evt.city || '',
            county: evt.county || '',
            state: evt.state || '',
          });
        }
      }

      // Sort by date descending
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const largest = events.length > 0
        ? Math.max(...events.map(e => e.hailSize))
        : 0;

      const report: HailReconPropertyReport = {
        address,
        latitude: lat,
        longitude: lon,
        totalStorms: data.total_storms || data.totalStorms || events.length,
        largestHailSize: largest,
        largestHailSizeLabel: largest > 0 ? getHailSizeLabel(largest) : 'None',
        mostRecentDate: events.length > 0 ? events[0].date : '',
        events,
        dataRange: {
          start: data.data_range?.start || data.startDate || '2011-01-01',
          end: data.data_range?.end || data.endDate || new Date().toISOString().slice(0, 10),
        },
        generatedAt: new Date().toISOString(),
      };

      return report;
    } catch (error) {
      console.error('HailRecon: Error normalizing response:', error);
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Export singleton
// ---------------------------------------------------------------------------

export const hailReconService = new HailReconService();