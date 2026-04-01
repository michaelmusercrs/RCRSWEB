// Geocoding Service
// Provides Google Maps geocoding, distance calculations, and proximity search
// Uses Google Maps Geocoding API (server-side)

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/** Google Maps Geocoding API address component */
interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface GeocodedResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
  components: {
    streetNumber?: string;
    street?: string;
    city?: string;
    county?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

export interface GeocodedContact {
  jnid: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
  type: 'contact' | 'install' | 'lead' | 'referral' | 'door_knock';
  salesRep: string;
  jobStatus: string;
  lastInteraction: string;
  interactionType: string;
  createdAt: string;
}

export function isGeocodingConfigured(): boolean {
  return Boolean(GOOGLE_MAPS_API_KEY);
}

class GeocodingService {
  // Geocode a single address using Google Maps Geocoding API
  async geocodeAddress(address: string): Promise<GeocodedResult | null> {
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('Google Maps API key not configured');
      return null;
    }

    try {
      const encodedAddress = encodeURIComponent(address);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.results?.length) {
        console.warn(`Geocoding failed for "${address}": ${data.status}`);
        return null;
      }

      const result = data.results[0];
      const components = this.parseAddressComponents(result.address_components);

      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
        components,
      };
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  // Parse Google address components into structured format
  private parseAddressComponents(components: GoogleAddressComponent[]): GeocodedResult['components'] {
    const result: GeocodedResult['components'] = {};

    for (const comp of components) {
      const types = comp.types as string[];
      if (types.includes('street_number')) {
        result.streetNumber = comp.long_name;
      } else if (types.includes('route')) {
        result.street = comp.long_name;
      } else if (types.includes('locality')) {
        result.city = comp.long_name;
      } else if (types.includes('administrative_area_level_2')) {
        result.county = comp.long_name.replace(' County', '');
      } else if (types.includes('administrative_area_level_1')) {
        result.state = comp.short_name;
      } else if (types.includes('postal_code')) {
        result.zip = comp.long_name;
      } else if (types.includes('country')) {
        result.country = comp.short_name;
      }
    }

    return result;
  }

  // Batch geocode multiple addresses with rate limiting
  // Google allows 50 req/sec, we batch in groups of 40 with delays
  async batchGeocodeAddresses(
    addresses: { id: string; address: string }[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, GeocodedResult>> {
    const results = new Map<string, GeocodedResult>();
    const batchSize = 40;
    const delayMs = 1100; // Just over 1 second between batches

    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async ({ id, address }) => {
          const result = await this.geocodeAddress(address);
          return { id, result };
        })
      );

      for (const { id, result } of batchResults) {
        if (result) {
          results.set(id, result);
        }
      }

      onProgress?.(Math.min(i + batchSize, addresses.length), addresses.length);

      // Rate limit delay between batches (skip for last batch)
      if (i + batchSize < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  // Calculate distance between two lat/lng points using Haversine formula
  // Returns distance in miles
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959; // Earth radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Find contacts within a radius of a center point
  findContactsWithinRadius(
    centerLat: number,
    centerLng: number,
    radiusMiles: number,
    contacts: GeocodedContact[]
  ): (GeocodedContact & { distanceMiles: number })[] {
    return contacts
      .map(contact => ({
        ...contact,
        distanceMiles: this.calculateDistance(centerLat, centerLng, contact.lat, contact.lng),
      }))
      .filter(contact => contact.distanceMiles <= radiusMiles)
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
  }

  // Find contacts on the same street
  findContactsOnStreet(
    street: string,
    contacts: GeocodedContact[]
  ): GeocodedContact[] {
    const streetLower = street.toLowerCase();
    return contacts.filter(c =>
      c.address.toLowerCase().includes(streetLower)
    );
  }

  // Find exact address matches
  findExactAddressMatch(
    address: string,
    contacts: GeocodedContact[]
  ): GeocodedContact[] {
    const normalized = this.normalizeAddress(address);
    return contacts.filter(c =>
      this.normalizeAddress(c.address) === normalized
    );
  }

  // Normalize an address for comparison (lowercase, remove extra spaces, standardize abbreviations)
  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\bstreet\b/g, 'st')
      .replace(/\bavenue\b/g, 'ave')
      .replace(/\bdrive\b/g, 'dr')
      .replace(/\blane\b/g, 'ln')
      .replace(/\broad\b/g, 'rd')
      .replace(/\bcourt\b/g, 'ct')
      .replace(/\bboulevard\b/g, 'blvd')
      .replace(/\bcircle\b/g, 'cir')
      .replace(/\bplace\b/g, 'pl')
      .replace(/\bnorth\b/g, 'n')
      .replace(/\bsouth\b/g, 's')
      .replace(/\beast\b/g, 'e')
      .replace(/\bwest\b/g, 'w')
      .replace(/,\s*/g, ', ')
      .trim();
  }

  // Get address intelligence for a new lead address
  async getAddressIntelligence(
    address: string,
    geocodedContacts: GeocodedContact[],
    radiusMiles: number = 2.0
  ): Promise<{
    geocoded: GeocodedResult | null;
    exactMatches: GeocodedContact[];
    sameStreet: GeocodedContact[];
    nearbyContacts: (GeocodedContact & { distanceMiles: number })[];
    nearbyByRep: Record<string, { count: number; contacts: (GeocodedContact & { distanceMiles: number })[] }>;
    county?: string;
  }> {
    const geocoded = await this.geocodeAddress(address);

    if (!geocoded) {
      return {
        geocoded: null,
        exactMatches: [],
        sameStreet: [],
        nearbyContacts: [],
        nearbyByRep: {},
      };
    }

    const exactMatches = this.findExactAddressMatch(address, geocodedContacts);

    const street = geocoded.components.street || '';
    const sameStreet = street ? this.findContactsOnStreet(street, geocodedContacts) : [];

    const nearbyContacts = this.findContactsWithinRadius(
      geocoded.lat, geocoded.lng, radiusMiles, geocodedContacts
    );

    // Group nearby contacts by sales rep
    const nearbyByRep: Record<string, { count: number; contacts: (GeocodedContact & { distanceMiles: number })[] }> = {};
    for (const contact of nearbyContacts) {
      if (!contact.salesRep) continue;
      if (!nearbyByRep[contact.salesRep]) {
        nearbyByRep[contact.salesRep] = { count: 0, contacts: [] };
      }
      nearbyByRep[contact.salesRep].count++;
      nearbyByRep[contact.salesRep].contacts.push(contact);
    }

    return {
      geocoded,
      exactMatches,
      sameStreet,
      nearbyContacts,
      nearbyByRep,
      county: geocoded.components.county,
    };
  }

  // Generate Google Street View Static API URL for a given address
  getStreetViewUrl(address: string, width: number = 600, height: number = 400): string {
    if (!GOOGLE_MAPS_API_KEY) return '';
    const encodedAddress = encodeURIComponent(address);
    return `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
  }

  // Generate static map URL for a pin location
  getStaticMapUrl(lat: number, lng: number, zoom: number = 15, width: number = 600, height: number = 300): string {
    if (!GOOGLE_MAPS_API_KEY) return '';
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&markers=color:green%7C${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
  }
}

// Export singleton
export const geocodingService = new GeocodingService();
