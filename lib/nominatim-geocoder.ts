/**
 * Nominatim Geocoding Service
 *
 * Free geocoding using OpenStreetMap's Nominatim API.
 * IMPORTANT: Rate limited to 1 request per second per Nominatim usage policy.
 * No API key required.
 *
 * https://nominatim.org/release-docs/develop/api/Search/
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'RiverCityRoofingSolutions/1.0';

// Enforce 1 request per second globally
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1050; // Slightly over 1 second for safety

export interface NominatimResult {
  lat: number;
  lng: number;
  displayName: string;
  placeId: string;
  type: string;
  importance: number;
}

/**
 * Wait until we can make the next request (1 req/sec rate limit)
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    const waitMs = MIN_INTERVAL_MS - elapsed;
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
  lastRequestTime = Date.now();
}

/**
 * Geocode a single address using Nominatim.
 * Returns null if the address could not be geocoded.
 */
export async function geocodeWithNominatim(address: string): Promise<NominatimResult | null> {
  if (!address || address.trim().length < 5) {
    return null;
  }

  await waitForRateLimit();

  try {
    const encodedAddress = encodeURIComponent(address.trim());
    const url = `${NOMINATIM_BASE}?format=json&q=${encodedAddress}&countrycodes=us&limit=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[Nominatim] HTTP ${response.status} for "${address}"`);
      return null;
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`[Nominatim] No results for "${address}"`);
      return null;
    }

    const result = data[0];

    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      displayName: result.display_name || address,
      placeId: String(result.place_id || ''),
      type: result.type || 'unknown',
      importance: parseFloat(result.importance) || 0,
    };
  } catch (error) {
    console.error(`[Nominatim] Error geocoding "${address}":`, error);
    return null;
  }
}

/**
 * Batch geocode multiple addresses sequentially (1 per second).
 * Returns a Map of id -> NominatimResult for successful geocodes.
 */
export async function batchGeocodeWithNominatim(
  items: { id: string; address: string }[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, NominatimResult>> {
  const results = new Map<string, NominatimResult>();

  for (let i = 0; i < items.length; i++) {
    const { id, address } = items[i];
    const result = await geocodeWithNominatim(address);

    if (result) {
      results.set(id, result);
    }

    onProgress?.(i + 1, items.length);
  }

  return results;
}

/**
 * Geocode an address and return it in the same format as the
 * existing GeocodingService.geocodeAddress() for drop-in compatibility.
 */
export async function nominatimGeocodeForLead(address: string): Promise<{
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
  components: {
    county?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
} | null> {
  const result = await geocodeWithNominatim(address);
  if (!result) return null;

  // Parse components from the display name
  // Nominatim display_name format: "123 Main St, Huntsville, Madison County, Alabama, 35801, United States"
  const parts = result.displayName.split(',').map(p => p.trim());
  const components: { county?: string; city?: string; state?: string; zip?: string } = {};

  // Try to extract components from the display name
  for (const part of parts) {
    if (/county/i.test(part)) {
      components.county = part.replace(/\s*county\s*/i, '').trim();
    } else if (/^\d{5}(-\d{4})?$/.test(part)) {
      components.zip = part;
    } else if (/^(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)$/i.test(part)) {
      components.state = part;
    }
  }

  // The city is typically the second component for US addresses
  if (parts.length >= 3 && !components.city) {
    // Skip first part (street), look for city-like part
    for (let i = 1; i < parts.length; i++) {
      if (!/county/i.test(parts[i]) && !/^\d{5}/.test(parts[i]) && !/united states/i.test(parts[i]) && !components.city) {
        // Skip if it's a state name
        if (!/^(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)$/i.test(parts[i])) {
          components.city = parts[i];
          break;
        }
      }
    }
  }

  return {
    lat: result.lat,
    lng: result.lng,
    formattedAddress: result.displayName,
    placeId: result.placeId,
    components,
  };
}
